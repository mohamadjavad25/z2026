#!/usr/bin/env bash
# Daily database dump, keeps 14 days. Copy /var/backups/frfro off the server too (see deploy/README.md).
set -euo pipefail
DIR=/var/backups/frfro
umask 077
sudo -u postgres pg_dump -Fc frfro > "$DIR/frfro-$(date +%Y%m%d-%H%M).dump"
find "$DIR" -name 'frfro-*.dump' -mtime +14 -delete
