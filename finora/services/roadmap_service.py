def roadmap_to_dict(r):
    """Convert RoadmapItem model to dictionary"""
    return {"id": r.id, "title": r.title, "icon": r.icon, "status": r.status, "position": r.position}


def validate_roadmap_item(data):
    """
    Validate roadmap item data.
    Returns True if valid, raises ValueError if invalid.
    """
    if not data.get("title"):
        raise ValueError("title required")
    return True
