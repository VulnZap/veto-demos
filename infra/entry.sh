#!/usr/bin/env bash
set -e

export DISPLAY=:99
export XDG_DATA_HOME=/data

exec supervisord -c /app/infra/supervisord.conf
