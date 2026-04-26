#!/bin/bash
set -e
if command -v semanage >/dev/null 2>&1; then
semanage fcontext -a -t usr_t '/opt/patch-agent(/.*)?' || true
restorecon -Rv /opt/patch-agent || true
semanage port -a -t http_port_t -p tcp 8080 || semanage port -m -t http_port_t -p tcp 8080 || true
fi
if command -v firewall-cmd >/dev/null 2>&1; then
firewall-cmd --add-port=8080/tcp || true
firewall-cmd --permanent --add-port=8080/tcp || true
firewall-cmd --reload || true
fi
