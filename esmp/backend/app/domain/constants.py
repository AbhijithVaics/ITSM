"""
Domain constants: fixed category lists, display ID prefixes, template IDs.
"""

# ── Incident categories (fixed list for Gen-1) ──
INCIDENT_CATEGORIES = {
    "Hardware": [
        "Desktop/Laptop",
        "Printer",
        "Monitor/Display",
        "Peripheral",
        "Network Equipment",
        "Phone/VoIP",
        "Other Hardware",
    ],
    "Software": [
        "Operating System",
        "Office/Productivity",
        "Email/Outlook",
        "Browser",
        "Business Application",
        "Security/Antivirus",
        "Other Software",
    ],
    "Network": [
        "Internet/Connectivity",
        "VPN",
        "Wi-Fi",
        "File Share/Drive",
        "DNS",
        "Other Network",
    ],
    "Access": [
        "Account Creation",
        "Password Reset",
        "Permission Change",
        "Account Deactivation",
        "Other Access",
    ],
    "Other": [
        "General Inquiry",
        "Facilities",
        "Other",
    ],
}

# Flat list of all categories for validation
ALL_CATEGORIES = list(INCIDENT_CATEGORIES.keys())
ALL_SUBCATEGORIES = [
    sub for subs in INCIDENT_CATEGORIES.values() for sub in subs
]


# ── Display ID prefixes ──
DISPLAY_ID_PREFIX = {
    "incident": "INC",
    "change": "CHG",
}


# ── Notification template IDs ──
NOTIFICATION_TEMPLATES = {
    "TPL_TICKET_CREATED": "ticket_created",
    "TPL_ASSIGNED": "ticket_assigned",
    "TPL_COMMENT": "comment_added",
    "TPL_RESOLVED": "ticket_resolved",
    "TPL_APPROVAL_REQ": "approval_requested",
    "TPL_APPROVAL_DEC": "approval_decided",
    "TPL_SLA_BREACH": "sla_breached",
}
