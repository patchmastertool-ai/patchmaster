patch@patchmaster:~$ ls
patchmaster-2.0.17.tar.gz
patch@patchmaster:~$ tar -xvf patchmaster-2.0.17.tar.gz
.env.production
agent/
auto-setup.ps1
auto-setup.sh
backend/
BUILD-MANIFEST.txt
docker-compose.ha.yml
docker-compose.prod.yml
docker-compose.yml
docs/
frontend/
Makefile
monitoring/
packaging/
README.md
scripts/
vendor/
vendor/vendor/
vendor/vendor/wheels/
vendor/vendor/wheels/blinker-1.9.0-py3-none-any.whl
vendor/vendor/wheels/certifi-2026.2.25-py3-none-any.whl
vendor/vendor/wheels/charset_normalizer-3.4.7-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl
vendor/vendor/wheels/click-8.3.2-py3-none-any.whl
vendor/vendor/wheels/flask-3.1.3-py3-none-any.whl
vendor/vendor/wheels/idna-3.11-py3-none-any.whl
vendor/vendor/wheels/itsdangerous-2.2.0-py3-none-any.whl
vendor/vendor/wheels/jinja2-3.1.6-py3-none-any.whl
vendor/vendor/wheels/markupsafe-3.0.3-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl
vendor/vendor/wheels/prometheus_client-0.25.0-py3-none-any.whl
vendor/vendor/wheels/psutil-7.2.2-cp36-abi3-manylinux2010_x86_64.manylinux_2_12_x86_64.manylinux_2_28_x86_64.whl
vendor/vendor/wheels/pyyaml-6.0.3-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl
vendor/vendor/wheels/requests-2.33.1-py3-none-any.whl
vendor/vendor/wheels/schedule-1.2.2-py3-none-any.whl
vendor/vendor/wheels/urllib3-2.6.3-py3-none-any.whl
vendor/vendor/wheels/werkzeug-3.1.8-py3-none-any.whl
scripts/build-all-agents.sh
scripts/build-complete-release.sh
scripts/build_all_platforms.py
scripts/build_release.py
scripts/comprehensive_wheel_analysis.py
scripts/download_wheels.py
scripts/generate_pdf_guides.py
scripts/install_patchmaster_docker.sh
scripts/install_patchmaster_server.sh
scripts/run_tests.py
scripts/uninstall_patchmaster.sh
scripts/verify_all_dependencies.py
packaging/build-package.sh
packaging/env.example
packaging/fpm/
packaging/install-bare.sh
packaging/nginx-ha.conf
packaging/prometheus-bare.yml
packaging/prometheus.service
packaging/rhel/
packaging/uninstall-bare.sh
packaging/uninstall.sh
packaging/rhel/patch-agent-heartbeat.service
packaging/rhel/patch-agent.service
packaging/rhel/patchmaster-agent.service
packaging/rhel/postinst.sh
packaging/rhel/selinux/
packaging/rhel/selinux/apply.sh
packaging/fpm/build-rpm.sh
monitoring/grafana/
monitoring/prometheus/
monitoring/prometheus/alerts.yml
monitoring/prometheus/prometheus.yml
monitoring/grafana/dashboards/
monitoring/grafana/provisioning/
monitoring/grafana/provisioning/dashboards/
monitoring/grafana/provisioning/datasources/
monitoring/grafana/provisioning/datasources/prometheus.yml
monitoring/grafana/provisioning/dashboards/dashboards.yml
monitoring/grafana/dashboards/patchmaster-availability.json
monitoring/grafana/dashboards/patchmaster-host-details.json
monitoring/grafana/dashboards/patchmaster-overview.json
frontend/dist/
frontend/Dockerfile
frontend/Dockerfile.prod
frontend/generate-pdf.js
frontend/index.html
frontend/nginx.conf
frontend/nginx.prod.conf
frontend/package-lock.json
frontend/package.json
frontend/playwright.config.js
frontend/public/
frontend/src/
frontend/test-results/
frontend/tests/
frontend/vite.config.js
frontend/tests/e2e/
frontend/tests/e2e/real-backend.spec.js
frontend/tests/e2e/smoke.spec.js
frontend/test-results/.last-run.json
frontend/src/AgentUpdatePage.jsx
frontend/src/AlertsCenterPage.jsx
frontend/src/AnalyticsOpsPage.jsx
frontend/src/App.css
frontend/src/App.jsx
frontend/src/AppIcons.jsx
frontend/src/appRuntime.js
frontend/src/AuditPage.jsx
frontend/src/BackupManagerPage.jsx
frontend/src/BulkPatchPage.jsx
frontend/src/CICDOpsPage.jsx
frontend/src/CVEOpsPage.jsx
frontend/src/DashboardOpsPage.jsx
frontend/src/HostsOpsPage.jsx
frontend/src/HostTimelinePage.jsx
frontend/src/JobsPage.jsx
frontend/src/LicenseOpsPage.jsx
frontend/src/LiveCommandPage.jsx
frontend/src/LocalRepoOpsPage.jsx
frontend/src/main.jsx
frontend/src/MaintenanceWindowsPage.jsx
frontend/src/MirrorRepoOpsPage.jsx
frontend/src/MonitoringOpsPage.jsx
frontend/src/NetworkBootPage.jsx
frontend/src/NotificationsPage.jsx
frontend/src/OnboardingOpsPage.jsx
frontend/src/OnboardingPage.jsx
frontend/src/OpsPages.css
frontend/src/OpsQueuePage.jsx
frontend/src/PatchHooksPage.jsx
frontend/src/PatchManagerOpsPage.jsx
frontend/src/PluginIntegrationsPage.jsx
frontend/src/PolicyManagerPage.jsx
frontend/src/ProvisioningPage.jsx
frontend/src/RemediationPage.jsx
frontend/src/ReportsOpsPage.jsx
frontend/src/RestoreDrillPage.jsx
frontend/src/RingRolloutPage.jsx
frontend/src/SettingsOpsPage.jsx
frontend/src/SLAOpsPage.jsx
frontend/src/SoftwarePage.jsx
frontend/src/TestingPage.jsx
frontend/src/ToastSystem.jsx
frontend/src/UsersOpsPage.jsx
frontend/public/logo-pm.svg
frontend/dist/assets/
frontend/dist/index.html
frontend/dist/logo-pm.svg
frontend/dist/assets/AgentUpdatePage-BA3F6j5j.js
frontend/dist/assets/AlertsCenterPage-DHYO__uu.js
frontend/dist/assets/AuditPage-BKFcl4P8.js
frontend/dist/assets/BackupManagerPage-Dw-zTwX6.js
frontend/dist/assets/BulkPatchPage-63io3cWu.js
frontend/dist/assets/HostTimelinePage-DAL1QzN4.js
frontend/dist/assets/index-87JgGx8b.css
frontend/dist/assets/index-BuOPJUzx.js
frontend/dist/assets/JobsPage-BEBQXEK8.js
frontend/dist/assets/LiveCommandPage-B9FwJ0Ys.js
frontend/dist/assets/MaintenanceWindowsPage-BSOfeigd.js
frontend/dist/assets/NetworkBootPage-CFubDoWt.js
frontend/dist/assets/NotificationsPage-BH3JFOIw.js
frontend/dist/assets/OpsQueuePage-CwQ93O5o.js
frontend/dist/assets/PatchHooksPage-CDhPvGRi.js
frontend/dist/assets/PluginIntegrationsPage-TU9eXVbU.js
frontend/dist/assets/PolicyManagerPage-CR-L49ZW.js
frontend/dist/assets/ProvisioningPage-DQdIFO0W.js
frontend/dist/assets/RemediationPage-DlcU_uN3.js
frontend/dist/assets/RestoreDrillPage-B2SqLwJ_.js
frontend/dist/assets/RingRolloutPage-NhRI4C9J.js
frontend/dist/assets/SoftwarePage-CI0W7aTA.js
frontend/dist/assets/vendor-CTJUxz_o.js
frontend/dist/assets/workspace-pages-BUsyGinj.css
frontend/dist/assets/workspace-pages-D52yVBAA.js
docs/docs/
docs/docs/public/
docs/docs/public/AGENT_TROUBLESHOOTING_RUNBOOK.md
docs/docs/public/INSTALL.md
docs/docs/public/nginx-patchmaster.conf
docs/docs/public/prometheus-scrape-template.yaml
docs/docs/public/SOP_End_User.md
backend/.env
backend/agent_manager.py
backend/api/
backend/audit.py
backend/auth/
backend/auth.py
backend/bootstrap_users.py
backend/database.py
backend/debug_test.py
backend/Dockerfile
backend/Dockerfile.prod
backend/drift_detector.py
backend/integrations/
backend/integrations sumo_logic.py
backend/license.py
backend/logging_config.py
backend/main.py
backend/middleware/
backend/migrations/
backend/models/
backend/monitoring_manager.py
backend/multi_tenant.py
backend/prometheus_targets.py
backend/pytest.ini
backend/requirements.txt
backend/scripts/
backend/static/
backend/tests/
backend/timezone_utils.py
backend/validators.py
backend/version_checker.py
backend/tests/conftest.py
backend/tests/test_agent_shutdown_queue.py
backend/tests/test_all_package_managers.py
backend/tests/test_bootstrap_users.py
backend/tests/test_build_release_authority.py
backend/tests/test_configuration_admin.py
backend/tests/test_license_middleware.py
backend/tests/test_master.py
backend/tests/test_network_boot.py
backend/tests/test_notifications_ws.py
backend/tests/test_pacman_manager.py
backend/tests/test_provisioning.py
backend/tests/test_site_support.py
backend/tests/test_software_kiosk.py
backend/tests/test_testing_api.py
backend/tests/test_windows_recovery.py
backend/static/agent-latest.aix.tar.gz
backend/static/agent-latest.apk
backend/static/agent-latest.deb
backend/static/agent-latest.hpux.tar.gz
backend/static/agent-latest.pkg.tar.zst
backend/static/agent-latest.rpm
backend/static/agent-latest.solaris.tar.gz
backend/static/agent-latest.txz
backend/static/agent-windows.zip
backend/static/install-agent.cmd
backend/static/install-agent.ps1
backend/static/install-agent.sh
backend/static/install.sh
backend/static/mirror/
backend/static/monitoring/
backend/static/packages/
backend/static/patchmaster-agent-installer.exe
backend/static/patchmaster-agent-uninstaller.exe
backend/static/packages/archive/
backend/static/monitoring/alerts.yml
backend/static/monitoring/grafana/
backend/static/monitoring/prometheus.yml
backend/static/monitoring/zabbix/
backend/static/monitoring/grafana/dashboards/
backend/static/monitoring/grafana/dashboards/patchmaster-availability.json
backend/static/monitoring/grafana/dashboards/patchmaster-host-details.json
backend/static/monitoring/grafana/dashboards/patchmaster-overview.json
backend/scripts/build_release.py
backend/scripts/monitoring-ctl.sh
backend/scripts/pm-backup-cli.py
backend/models/db_models.py
backend/models/__init__.py
backend/migrations/20260311_add_backup_storage_columns.sql
backend/migrations/20260311_add_cve_metadata.sql
backend/migrations/20260329_alert_actions_tickets.sql
backend/migrations/20260329_enterprise_rollout_foundation.sql
backend/migrations/20260330_cicd_approval_sla_audit.sql
backend/migrations/20260330_cicd_delivery_receipts_and_release_artifacts.sql
backend/migrations/20260330_cicd_stage_approval_dora.sql
backend/migrations/20260330_patch_history_presets.sql
backend/migrations/20260330_runbook_profiles_schedules_history.sql
backend/migrations/20260331_cicd_secrets_agent_targets.sql
backend/migrations/20260331_host_agent_id_unique_index.sql
backend/migrations/20260414_add_host_ip_hostname_unique_constraint.sql
backend/migrations/20260414_add_performance_indexes.sql
backend/migrations/20260414_fix_bulk_job_unique_constraint.sql
backend/middleware/rate_limit.py
backend/middleware/security.py
backend/integrations/custom.py
backend/integrations/jira.py
backend/integrations/servicenow.py
backend/integrations/slack.py
backend/integrations/splunk.py
backend/integrations/sumo_logic.py
backend/integrations/__init__.py
backend/auth/rbac.py
backend/auth/security.py
backend/api/agent_proxy.py
backend/api/agent_update.py
backend/api/audit.py
backend/api/auth_api.py
backend/api/backups.py
backend/api/bulk_patch.py
backend/api/canary_testing.py
backend/api/cicd.py
backend/api/cicd_agent_targets.py
backend/api/cicd_secrets.py
backend/api/compliance.py
backend/api/cve.py
backend/api/dashboard.py
backend/api/dependency_resolver.py
backend/api/git_integration.py
backend/api/graphql.py
backend/api/groups.py
backend/api/hooks.py
backend/api/hosts_v2.py
backend/api/host_timeline.py
backend/api/jobs_v2.py
backend/api/ldap_auth.py
backend/api/license_router.py
backend/api/maintenance.py
backend/api/metrics.py
backend/api/mirror_repos.py
backend/api/monitoring.py
backend/api/network_boot.py
backend/api/notifications.py
backend/api/oidc_auth.py
backend/api/ops_queue.py
backend/api/packages_router.py
backend/api/patch_history_presets.py
backend/api/plugins.py
backend/api/policies.py
backend/api/provisioning.py
backend/api/rbac.py
backend/api/register_v2.py
backend/api/remediation.py
backend/api/reports.py
backend/api/restore_drills.py
backend/api/ring_rollout.py
backend/api/rolling_restart.py
backend/api/runbook.py
backend/api/schedules.py
backend/api/search.py
backend/api/sla.py
backend/api/software_kiosk.py
backend/api/testing.py
backend/api/webhook_retry.py
backend/api/windows_snapshot.py
agent/--skip-agents
agent/2.0.0
agent/agent.py
agent/aix_manager.py
agent/build-aix.sh
agent/build-all.sh
agent/build-apk-simple.sh
agent/build-apk.sh
agent/build-arch.sh
agent/build-deb.sh
agent/build-freebsd-portable.sh
agent/build-freebsd-simple.sh
agent/build-freebsd.sh
agent/build-hpux.sh
agent/build-rpm-simple.sh
agent/build-rpm.sh
agent/build-solaris.sh
agent/build_agent_artifacts.py
agent/build_windows_full.py
agent/build_windows_iexpress_installer.py
agent/Dockerfile
agent/hpux_manager.py
agent/logs/
agent/main.py
agent/offline-pkgs/
agent/patch-agent-heartbeat.spec
agent/patch-agent.spec
agent/patchmaster-agent-installer.spec
agent/patchrepo-data/
agent/patchrepo.py
agent/patchrepo_api.py
agent/patchrepo_ui.html
agent/requirements.txt
agent/setup.py
agent/snapshots/
agent/solaris_manager.py
agent/uninstall_agent.py
agent/uninstall_agent.sh
agent/windows_installer.py
agent/windows_installer_payload/
agent/windows_service/
agent/__init__.py
agent/windows_service/LICENSE.txt
agent/windows_service/winsw.exe
agent/windows_installer_payload/install.cmd
agent/patchrepo-data/patch-packages/
agent/patchrepo-data/repos/
agent/patchrepo-data/repos/7a7cd0fe/
agent/patchrepo-data/repos/7a7cd0fe/.patchrepo.json
agent/patchrepo-data/repos/7a7cd0fe/branches.json
agent/patchrepo-data/repos/7a7cd0fe/commits.json
agent/patchrepo-data/repos/7a7cd0fe/main.json
agent/patchrepo-data/repos/7a7cd0fe/pulls.json
agent/patchrepo-data/patch-packages/7a7cd0fe/
agent/patchrepo-data/patch-packages/7a7cd0fe.index.json
agent/patchrepo-data/patch-packages/7a7cd0fe/bb7b03e2-1f3.json
patch@patchmaster:~$ sudo su
root@patchmaster:/home/patch# ls
agent           auto-setup.sh  BUILD-MANIFEST.txt     docker-compose.prod.yml  docs      Makefile    packaging                  README.md  vendor
auto-setup.ps1  backend        docker-compose.ha.yml  docker-compose.yml       frontend  monitoring  patchmaster-2.0.17.tar.gz  scripts
root@patchmaster:/home/patch# cd packaging/
root@patchmaster:/home/patch/packaging# ls
build-package.sh  env.example  fpm  install-bare.sh  nginx-ha.conf  prometheus-bare.yml  prometheus.service  rhel  uninstall-bare.sh  uninstall.sh
root@patchmaster:/home/patch/packaging# exit
exit
patch@patchmaster:~$ cd packaging/
patch@patchmaster:~/packaging$ ls
build-package.sh  env.example  fpm  install-bare.sh  nginx-ha.conf  prometheus-bare.yml  prometheus.service  rhel  uninstall-bare.sh  uninstall.sh
patch@patchmaster:~/packaging$ chmod -R a+x *
patch@patchmaster:~/packaging$ lz
Command 'lz' not found, but can be installed with:
sudo apt install mtools
patch@patchmaster:~/packaging$ ls
build-package.sh  env.example  fpm  install-bare.sh  nginx-ha.conf  prometheus-bare.yml  prometheus.service  rhel  uninstall-bare.sh  uninstall.sh
patch@patchmaster:~/packaging$ sudo ./install-bare.sh

  ____       _       _   __  __
 |  _ \ __ _| |_ ___| | |  \/  | __ _ ___| |_ ___ _ __
 | |_) / _` | __/ __| |_| |\/| |/ _` / __| __/ _ \ '__|
 |  __/ (_| | || (__| '_| |  | | (_| \__ \ ||  __/ |
 |_|   \__,_|\__\___|_| |_|  |_|\__,_|___/\__\___|_|

    PatchMaster by VYGROUP  v2.0.0
        Bare-Metal Installer

[+] Step 1/8: Detecting operating system...
[+]   Detected: ubuntu (debian family), package manager: apt
[+]   Python version: 3.10
[+] Step 2/8: Installing system packages...
[+]   Configuring PostgreSQL repository...
[+]   PostgreSQL 17 already installed — skipping PGDG repository setup
[+]   Python 3.10.12
[+]   Node v20.20.2
[+]   PostgreSQL 17.9
[+]   Nginx 1.18.0 (Ubuntu)
[+] Step 3/8: Setting up user and directories...
[+]   Created system user: patchmaster
[+]   Installed CLI: patchmaster-backup
[+]   Installed to: /opt/patchmaster
[+] Step 4/8: Configuring environment...
[+]   Created .env from template
[+]   Reusing shared LICENSE_VERIFY_PUBLIC_KEY from /var/lib/patchmaster/shared-license.env
[+]   Reusing shared LICENSE_DECRYPT_PRIVATE_KEY from /var/lib/patchmaster/shared-license.env
[+]   Reusing shared LICENSE_ENCRYPT_PUBLIC_KEY from /var/lib/patchmaster/shared-license.env
[+]   Reusing shared LICENSE_SIGN_KEY from /var/lib/patchmaster/shared-license.env
[!]   PM_SECRET_KEY is unset or using the template placeholder; generating a Fernet key.
[+]   Auto-detected server IP: 172.24.1.254
[+]   Backend port: 8000, Frontend port: 3000
[+]   Monitoring: Prometheus :9090, Grafana :3001
[+] Step 5/8: Configuring PostgreSQL...
[+]   Windows wbadmin target: \172.24.1.254\patchmaster-wbadmin
Synchronizing state of postgresql.service with SysV service script with /lib/systemd/systemd-sysv-install.
Executing: /lib/systemd/systemd-sysv-install enable postgresql
CREATE ROLE
CREATE DATABASE
GRANT
[+]   PostgreSQL ready ? database: patchmaster, user: patchmaster
[+] Step 6/8: Setting up backend...
[+]   Bundled pip wheel not found; keeping the existing pip version
Collecting fastapi==0.135.1
  Using cached fastapi-0.135.1-py3-none-any.whl (116 kB)
Collecting uvicorn==0.41.0
  Using cached uvicorn-0.41.0-py3-none-any.whl (68 kB)
Collecting pydantic==2.12.5
  Using cached pydantic-2.12.5-py3-none-any.whl (463 kB)
Collecting python-dotenv==1.2.2
  Using cached python_dotenv-1.2.2-py3-none-any.whl (22 kB)
Collecting httpx==0.28.1
  Using cached httpx-0.28.1-py3-none-any.whl (73 kB)
Collecting requests==2.32.5
  Using cached requests-2.32.5-py3-none-any.whl (64 kB)
Collecting sqlalchemy[asyncio]==2.0.48
  Using cached sqlalchemy-2.0.48-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl (3.2 MB)
Collecting asyncpg==0.30.0
  Using cached asyncpg-0.30.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (2.9 MB)
Collecting python-multipart==0.0.22
  Using cached python_multipart-0.0.22-py3-none-any.whl (24 kB)
Collecting PyJWT==2.10.1
  Using cached PyJWT-2.10.1-py3-none-any.whl (22 kB)
Collecting passlib[bcrypt]==1.7.4
  Using cached passlib-1.7.4-py2.py3-none-any.whl (525 kB)
Collecting bcrypt==5.0.0
  Using cached bcrypt-5.0.0-cp39-abi3-manylinux_2_34_x86_64.whl (278 kB)
Collecting prometheus-client==0.24.1
  Using cached prometheus_client-0.24.1-py3-none-any.whl (64 kB)
Collecting croniter==6.0.0
  Using cached croniter-6.0.0-py2.py3-none-any.whl (25 kB)
Collecting psutil==7.2.2
  Using cached psutil-7.2.2-cp36-abi3-manylinux2010_x86_64.manylinux_2_12_x86_64.manylinux_2_28_x86_64.whl (155 kB)
Collecting fpdf==1.7.2
  Using cached fpdf-1.7.2.tar.gz (39 kB)
  Preparing metadata (setup.py) ... done
Collecting pandas==2.3.2
  Using cached pandas-2.3.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (12.3 MB)
Collecting openpyxl==3.1.5
  Using cached openpyxl-3.1.5-py2.py3-none-any.whl (250 kB)
Collecting PyYAML==6.0.3
  Using cached pyyaml-6.0.3-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl (770 kB)
Collecting setuptools==82.0.1
  Using cached setuptools-82.0.1-py3-none-any.whl (1.0 MB)
Collecting cryptography>=42.0.0
  Using cached cryptography-46.0.7-cp38-abi3-manylinux_2_34_x86_64.whl (4.4 MB)
Collecting slowapi==0.1.9
  Using cached slowapi-0.1.9-py3-none-any.whl (14 kB)
Collecting authlib==1.3.2
  Using cached Authlib-1.3.2-py2.py3-none-any.whl (225 kB)
Collecting itsdangerous==2.2.0
  Using cached itsdangerous-2.2.0-py3-none-any.whl (16 kB)
Collecting strawberry-graphql[fastapi]>=0.217.0
  Using cached strawberry_graphql-0.314.3-py3-none-any.whl (324 kB)
Collecting dulwich>=0.25.0
  Using cached dulwich-1.1.0-cp310-cp310-manylinux_2_28_x86_64.whl (1.4 MB)
Collecting typing-inspection>=0.4.2
  Using cached typing_inspection-0.4.2-py3-none-any.whl (14 kB)
Collecting annotated-doc>=0.0.2
  Using cached annotated_doc-0.0.4-py3-none-any.whl (5.3 kB)
Collecting starlette>=0.46.0
  Using cached starlette-1.0.0-py3-none-any.whl (72 kB)
Collecting typing-extensions>=4.8.0
  Using cached typing_extensions-4.15.0-py3-none-any.whl (44 kB)
Collecting click>=7.0
  Using cached click-8.3.2-py3-none-any.whl (108 kB)
Collecting h11>=0.8
  Using cached h11-0.16.0-py3-none-any.whl (37 kB)
Collecting annotated-types>=0.6.0
  Using cached annotated_types-0.7.0-py3-none-any.whl (13 kB)
Collecting pydantic-core==2.41.5
  Using cached pydantic_core-2.41.5-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (2.1 MB)
Collecting idna
  Using cached idna-3.11-py3-none-any.whl (71 kB)
Collecting certifi
  Using cached certifi-2026.2.25-py3-none-any.whl (153 kB)
Collecting anyio
  Using cached anyio-4.13.0-py3-none-any.whl (114 kB)
Collecting httpcore==1.*
  Using cached httpcore-1.0.9-py3-none-any.whl (78 kB)
Collecting urllib3<3,>=1.21.1
  Using cached urllib3-2.6.3-py3-none-any.whl (131 kB)
Collecting charset_normalizer<4,>=2
  Using cached charset_normalizer-3.4.7-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl (216 kB)
Collecting greenlet>=1
  Using cached greenlet-3.4.0-cp310-cp310-manylinux_2_24_x86_64.manylinux_2_28_x86_64.whl (611 kB)
Collecting async-timeout>=4.0.3
  Using cached async_timeout-5.0.1-py3-none-any.whl (6.2 kB)
Collecting python-dateutil
  Using cached python_dateutil-2.9.0.post0-py2.py3-none-any.whl (229 kB)
Collecting pytz>2021.1
  Using cached pytz-2026.1.post1-py2.py3-none-any.whl (510 kB)
Collecting numpy>=1.22.4
  Using cached numpy-2.2.6-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (16.8 MB)
Collecting tzdata>=2022.7
  Using cached tzdata-2026.1-py2.py3-none-any.whl (348 kB)
Collecting et-xmlfile
  Using cached et_xmlfile-2.0.0-py3-none-any.whl (18 kB)
Collecting limits>=2.3
  Using cached limits-5.8.0-py3-none-any.whl (60 kB)
Collecting cffi>=2.0.0
  Using cached cffi-2.0.0-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl (216 kB)
Collecting cross-web>=0.4.0
  Using cached cross_web-0.6.0-py3-none-any.whl (24 kB)
Collecting packaging>=23
  Using cached packaging-26.1-py3-none-any.whl (95 kB)
Collecting graphql-core<3.4.0,>=3.2.0
  Using cached graphql_core-3.2.8-py3-none-any.whl (207 kB)
Collecting pycparser
  Using cached pycparser-3.0-py3-none-any.whl (48 kB)
Collecting deprecated>=1.2
  Using cached deprecated-1.3.1-py2.py3-none-any.whl (11 kB)
Collecting six>=1.5
  Using cached six-1.17.0-py2.py3-none-any.whl (11 kB)
Collecting exceptiongroup>=1.0.2
  Using cached exceptiongroup-1.3.1-py3-none-any.whl (16 kB)
Collecting wrapt<3,>=1.10
  Using cached wrapt-2.1.2-cp310-cp310-manylinux1_x86_64.manylinux_2_28_x86_64.manylinux_2_5_x86_64.whl (113 kB)
Using legacy 'setup.py install' for fpdf, since package 'wheel' is not installed.
Installing collected packages: pytz, passlib, fpdf, wrapt, urllib3, tzdata, typing-extensions, six, setuptools, PyYAML, python-multipart, python-dotenv, PyJWT, pycparser, psutil, prometheus-client, packaging, numpy, itsdangerous, idna, h11, greenlet, graphql-core, et-xmlfile, click, charset_normalizer, certifi, bcrypt, async-timeout, annotated-types, annotated-doc, uvicorn, typing-inspection, sqlalchemy, requests, python-dateutil, pydantic-core, openpyxl, httpcore, exceptiongroup, dulwich, deprecated, cross-web, cffi, asyncpg, strawberry-graphql, pydantic, pandas, limits, cryptography, croniter, anyio, starlette, slowapi, httpx, authlib, fastapi
  Running setup.py install for fpdf ... done
  Attempting uninstall: setuptools
    Found existing installation: setuptools 59.6.0
    Uninstalling setuptools-59.6.0:
      Successfully uninstalled setuptools-59.6.0
Successfully installed PyJWT-2.10.1 PyYAML-6.0.3 annotated-doc-0.0.4 annotated-types-0.7.0 anyio-4.13.0 async-timeout-5.0.1 asyncpg-0.30.0 authlib-1.3.2 bcrypt-5.0.0 certifi-2026.2.25 cffi-2.0.0 charset_normalizer-3.4.7 click-8.3.2 croniter-6.0.0 cross-web-0.6.0 cryptography-46.0.7 deprecated-1.3.1 dulwich-1.1.0 et-xmlfile-2.0.0 exceptiongroup-1.3.1 fastapi-0.135.1 fpdf-1.7.2 graphql-core-3.2.8 greenlet-3.4.0 h11-0.16.0 httpcore-1.0.9 httpx-0.28.1 idna-3.11 itsdangerous-2.2.0 limits-5.8.0 numpy-2.2.6 openpyxl-3.1.5 packaging-26.1 pandas-2.3.2 passlib-1.7.4 prometheus-client-0.24.1 psutil-7.2.2 pycparser-3.0 pydantic-2.12.5 pydantic-core-2.41.5 python-dateutil-2.9.0.post0 python-dotenv-1.2.2 python-multipart-0.0.22 pytz-2026.1.post1 requests-2.32.5 setuptools-82.0.1 six-1.17.0 slowapi-0.1.9 sqlalchemy-2.0.48 starlette-1.0.0 strawberry-graphql-0.314.3 typing-extensions-4.15.0 typing-inspection-0.4.2 tzdata-2026.1 urllib3-2.6.3 uvicorn-0.41.0 wrapt-2.1.2
[+]   Python venv created, dependencies installed
[+]   Verifying backend imports...
Python version: 3.10.12 (main, Mar  3 2026, 11:56:32) [GCC 11.4.0]
Python executable: /opt/patchmaster/backend/venv/bin/python
Python path: ['', '/usr/lib/python310.zip', '/usr/lib/python3.10', '/usr/lib/python3.10/lib-dynload', '/opt/patchmaster/backend/venv/lib/python3.10/site-packages']
database module loaded
__getattr__ defined: True
async_session in dir: False
async_session type: async_sessionmaker
main module loaded successfully
[+]   Initializing database schema...
Traceback (most recent call last):
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 550, in _prepare_and_execute
    self._rows = deque(await prepared_stmt.fetch(*parameters))
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/asyncpg/prepared_stmt.py", line 176, in fetch
    data = await self.__bind_execute(args, 0, timeout)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/asyncpg/prepared_stmt.py", line 267, in __bind_execute
    data, status, _ = await self.__do_execute(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/asyncpg/prepared_stmt.py", line 256, in __do_execute
    return await executor(protocol)
  File "asyncpg/protocol/protocol.pyx", line 206, in bind_execute
asyncpg.exceptions.DuplicateTableError: relation "ix_patch_repos_name" already exists

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1967, in _exec_single_context
    self.dialect.do_execute(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 585, in execute
    self._adapt_connection.await_(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 132, in await_only
    return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 196, in greenlet_spawn
    value = await result
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 563, in _prepare_and_execute
    self._handle_exception(error)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 513, in _handle_exception
    self._adapt_connection._handle_exception(error)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 797, in _handle_exception
    raise translated_error from error
sqlalchemy.dialects.postgresql.asyncpg.AsyncAdapt_asyncpg_dbapi.ProgrammingError: <class 'asyncpg.exceptions.DuplicateTableError'>: relation "ix_patch_repos_name" already exists

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "<string>", line 1, in <module>
  File "/usr/lib/python3.10/asyncio/runners.py", line 44, in run
    return loop.run_until_complete(main)
  File "/usr/lib/python3.10/asyncio/base_events.py", line 649, in run_until_complete
    return future.result()
  File "/opt/patchmaster/backend/database.py", line 137, in init_db
    await conn.run_sync(Base.metadata.create_all, checkfirst=True)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/ext/asyncio/engine.py", line 888, in run_sync
    return await greenlet_spawn(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 201, in greenlet_spawn
    result = context.throw(*sys.exc_info())
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/sql/schema.py", line 5928, in create_all
    bind._run_ddl_visitor(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 2467, in _run_ddl_visitor
    ).traverse_single(element)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/sql/visitors.py", line 661, in traverse_single
    return meth(obj, **kw)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/sql/ddl.py", line 984, in visit_metadata
    self.traverse_single(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/sql/visitors.py", line 661, in traverse_single
    return meth(obj, **kw)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/sql/ddl.py", line 1026, in visit_table
    self.traverse_single(index, create_ok=True)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/sql/visitors.py", line 661, in traverse_single
    return meth(obj, **kw)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/sql/ddl.py", line 1063, in visit_index
    CreateIndex(index)._invoke_with(self.connection)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/sql/ddl.py", line 321, in _invoke_with
    return bind.execute(self)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1419, in execute
    return meth(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/sql/ddl.py", line 187, in _execute_on_connection
    return connection._execute_ddl(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1530, in _execute_ddl
    ret = self._execute_context(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1846, in _execute_context
    return self._exec_single_context(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1986, in _exec_single_context
    self._handle_dbapi_exception(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 2363, in _handle_dbapi_exception
    raise sqlalchemy_exception.with_traceback(exc_info[2]) from e
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1967, in _exec_single_context
    self.dialect.do_execute(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/engine/default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 585, in execute
    self._adapt_connection.await_(
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 132, in await_only
    return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 196, in greenlet_spawn
    value = await result
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 563, in _prepare_and_execute
    self._handle_exception(error)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 513, in _handle_exception
    self._adapt_connection._handle_exception(error)
  File "/opt/patchmaster/backend/venv/lib/python3.10/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 797, in _handle_exception
    raise translated_error from error
sqlalchemy.exc.ProgrammingError: (sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class 'asyncpg.exceptions.DuplicateTableError'>: relation "ix_patch_repos_name" already exists
[SQL: CREATE UNIQUE INDEX ix_patch_repos_name ON patch_repos (name)]
(Background on this error at: https://sqlalche.me/e/20/f405)
[!]   Database initialization failed. Ensure PostgreSQL is running and credentials are correct.
[+]   Created patchmaster-backend.service
[+]   Frontend E2E Smoke configured for http://172.24.1.254:3000 (user: qa-smoke)
[+] Step 7/8: Setting up frontend & starting services...
[+]   Using pre-built frontend
[+]   Installing frontend E2E tooling...
^C
patch@patchmaster:~/packaging$