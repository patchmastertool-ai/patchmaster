"""External integrations for PatchMaster.

Provides integration modules for:
- Splunk: Send events to Splunk HTTP Event Collector
- Sumo Logic: Send events to Sumo Logic HTTP Source
- ServiceNow: Create incidents via ServiceNow REST API
"""

from integrations.splunk import (
    SplunkIntegration,
    send_patch_job_event,
    send_host_event,
    send_cve_event,
)
from integrations.sumo_logic import SumoLogicIntegration, send_log_message
from integrations.servicenow import (
    ServiceNowIntegration,
    ServiceNowPriority,
    ServiceNowUrgency,
    ServiceNowImpact,
    create_patch_failure_incident,
    create_cve_alert_incident,
)

__all__ = [
    # Splunk
    "SplunkIntegration",
    "send_patch_job_event",
    "send_host_event",
    "send_cve_event",
    # Sumo Logic
    "SumoLogicIntegration",
    "send_log_message",
    # ServiceNow
    "ServiceNowIntegration",
    "ServiceNowPriority",
    "ServiceNowUrgency",
    "ServiceNowImpact",
    "create_patch_failure_incident",
    "create_cve_alert_incident",
]
