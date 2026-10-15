#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for frfro. Run as root ON THE SERVER:
#
#   DEPLOY_PUBKEY="ssh-ed25519 AAAA... you@pc" DOMAIN=new.frfro.ir bash setup-server.sh
#
# DEPLOY_PUBKEY  (required) public SSH key allowed to deploy (the matching private key stays with you / GitHub secret).
# DOMAIN         (optional) site domain. Without it nginx answers on the IP over plain HTTP.
# SITE_URL       (optional) full public URL; default https://$DOMAIN or http://<server ip>.
# CERTBOT_EMAIL  (optional) email for Let's Encrypt; with DOMAIN set, a certificate is requested.
#
# Safe to run again: it never overwrites an existing database password, secrets or env file.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run as root." >&2; exit 1; fi
if [ -z "${DEPLOY_PUBKEY:-}" ]; then echo "Set DEPLOY_PUBKEY to a public SSH key." >&2; exit 1; fi

DOMAIN="${DOMAIN:-}"
APP_USER=frfro
DEPLOY_USER=deploy
APP_DIR=/opt/frfro
ENV_DIR=/etc/frfro
ENV_FILE="$ENV_DIR/env"
SERVER_IP="$(hostname -I | awk '{print $1}')"
SITE_URL="${SITE_URL:-$([ -n "$DOMAIN" ] && echo "https://$DOMAIN" || echo "http://$SERVER_IP")}"

export DEBIAN_FRONTEND=noninteractive
echo "==> Packages"
apt-get update -y
apt-get install -y nginx postgresql postgresql-contrib ufw curl ca-certificates openssl cron certbot python3-certbot-nginx

echo "==> Users and folders"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
grep -qxF "$DEPLOY_PUBKEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null \
  || echo "$DEPLOY_PUBKEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
install -d -m 755 -o root -g root "$APP_DIR" "$APP_DIR/bin"
install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$APP_DIR/releases"
install -d -m 750 -o root -g "$APP_USER" "$ENV_DIR"
install -d -m 700 -o root -g root /var/backups/frfro

echo "==> Database"
systemctl enable --now postgresql
if [ ! -f "$ENV_DIR/.dbpass" ]; then
  openssl rand -hex 24 > "$ENV_DIR/.dbpass"
  chmod 600 "$ENV_DIR/.dbpass"
fi
DB_PASS="$(cat "$ENV_DIR/.dbpass")"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'frfro') THEN
    CREATE ROLE frfro LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE frfro PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='frfro'" | grep -q 1 \
  || sudo -u postgres createdb -O frfro frfro

echo "==> Secrets and env file"
b64url() { base64 -w0 | tr '+/' '-_' | tr -d '='; }
if [ ! -f "$ENV_FILE" ]; then
  # Web Push (VAPID) P-256 key pair, raw format: private = 32 bytes, public = 65 bytes (uncompressed point).
  der="$(mktemp)"
  openssl ecparam -name prime256v1 -genkey -noout -outform DER > "$der"
  vapid_priv="$(tail -c +8 "$der" | head -c 32 | b64url)"
  vapid_pub="$(tail -c 65 "$der" | b64url)"
  rm -f "$der"
  umask 037
  cat > "$ENV_FILE" <<ENV
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
NEXT_PUBLIC_SITE_URL=$SITE_URL
POSTGRES_URL=postgresql://frfro:$DB_PASS@127.0.0.1:5432/frfro?sslmode=disable
CRON_SECRET=$(openssl rand -hex 32)
FRFRO_OTP_SECRET=$(openssl rand -hex 32)
FRFRO_ADMIN_SECRET=$(openssl rand -hex 32)
FRFRO_ADMIN_SETUP_KEY=$(openssl rand -hex 16)
# Phone numbers of admins, comma separated (e.g. 09120000000). Empty = nobody can open /admin.
FRFRO_ADMIN_PHONES=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=$vapid_pub
FRFRO_VAPID_PRIVATE_KEY=$vapid_priv
FRFRO_VAPID_CONTACT=mailto:admin@frfro.ir
# SMS (uncomment and fill in when the provider account is ready; see docs/OPERATIONS.md):
# FRFRO_SMS_PROVIDER=farazsms
# FARAZSMS_API_KEY=
# FARAZSMS_PATTERN_CODE=
# FARAZSMS_SENDER=
# FRFRO_OTP_REQUIRED=1
ENV
  chown root:"$APP_USER" "$ENV_FILE"; chmod 640 "$ENV_FILE"
  echo "Created $ENV_FILE"
else
  echo "$ENV_FILE exists, left untouched."
fi
# Values the deploy script needs at build time (public, not secret).
grep '^NEXT_PUBLIC_VAPID_PUBLIC_KEY=' "$ENV_FILE" | cut -d= -f2- > "$ENV_DIR/vapid.pub"
grep '^NEXT_PUBLIC_SITE_URL=' "$ENV_FILE" | cut -d= -f2- > "$ENV_DIR/site-url"
chmod 644 "$ENV_DIR/vapid.pub" "$ENV_DIR/site-url"
chmod 755 "$ENV_DIR"

echo "==> Helper scripts"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -m 755 -o root -g root "$HERE/server/release.sh"   "$APP_DIR/bin/release.sh"
install -m 755 -o root -g root "$HERE/server/db-url.sh"    "$APP_DIR/bin/db-url.sh"
install -m 755 -o root -g root "$HERE/server/cron-call.sh" "$APP_DIR/bin/cron-call.sh"
install -m 755 -o root -g root "$HERE/server/backup-db.sh" "$APP_DIR/bin/backup-db.sh"
install -m 644 "$HERE/server/frfro.service" /etc/systemd/system/frfro.service
install -m 644 "$HERE/server/frfro.cron"    /etc/cron.d/frfro
cat > /etc/sudoers.d/frfro-deploy <<SUDO
$DEPLOY_USER ALL=(root) NOPASSWD: $APP_DIR/bin/release.sh, $APP_DIR/bin/db-url.sh
SUDO
chmod 440 /etc/sudoers.d/frfro-deploy
visudo -cf /etc/sudoers.d/frfro-deploy >/dev/null
systemctl daemon-reload
systemctl enable frfro.service

echo "==> nginx"
sed "s/__SERVER_NAME__/${DOMAIN:-_}/" "$HERE/server/nginx.conf" > /etc/nginx/sites-available/frfro
ln -sf /etc/nginx/sites-available/frfro /etc/nginx/sites-enabled/frfro
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable

if [ -n "$DOMAIN" ] && [ -n "${CERTBOT_EMAIL:-}" ]; then
  echo "==> HTTPS certificate for $DOMAIN (the domain must already point to this server)"
  certbot --nginx -d "$DOMAIN" -m "$CERTBOT_EMAIL" --agree-tos --no-eff-email --redirect -n \
    || echo "certbot failed: check the DNS record, then run: certbot --nginx -d $DOMAIN"
fi

cat <<DONE

Server is ready. Not started yet: the first deploy ships the code.
  Site URL in env : $SITE_URL
  Env file        : $ENV_FILE   (set FRFRO_ADMIN_PHONES there, then: systemctl restart frfro)
  Deploy user     : $DEPLOY_USER (key login only)

Hardening, AFTER you confirmed that "ssh $DEPLOY_USER@$SERVER_IP" works with your key:
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl reload ssh
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl reload ssh
DONE
