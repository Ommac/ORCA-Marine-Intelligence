"""
ORCA Marine Intelligence - Geofencing Registry (Phase 1 Dummy Foundation)
Provides loading, in-memory caching, normalization, and filtering of dummy maritime geofences.
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger("orca.geofencing.registry")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

GEOFENCE_CATEGORIES: Dict[str, str] = {
    "eez": "Dummy EEZ Boundary",
    "restricted_waters": "Dummy Restricted Waters",
    "mpa": "Dummy Marine Protected Area",
    "ecologically_sensitive": "Dummy Ecologically Sensitive Zone",
}

GEOFENCE_FILES: Dict[str, str] = {
    "eez": "eez_india.geojson",
    "restricted_waters": "restricted_waters.geojson",
    "mpa": "marine_protected_areas.geojson",
    "ecologically_sensitive": "ecologically_sensitive_zones.geojson",
}

_CACHED_COLLECTION: Optional[Dict[str, Any]] = None


def _normalize_feature(feature: Dict[str, Any], default_category: str) -> Dict[str, Any]:
    """Normalize properties and structure of a GeoJSON Feature."""
    props = dict(feature.get("properties") or {})
    feat_id = feature.get("id") or props.get("id") or f"dummy-{default_category}-001"
    category = props.get("category") or default_category
    category_label = props.get("category_label") or GEOFENCE_CATEGORIES.get(category, category)
    restriction_level = props.get("restriction_level") or "RESTRICTED"
    name = props.get("name") or category_label
    description = props.get("description") or ""
    dataset_type = props.get("dataset_type") or "DUMMY"

    normalized_props = {
        **props,
        "id": feat_id,
        "name": name,
        "category": category,
        "category_label": category_label,
        "restriction_level": restriction_level,
        "description": description,
        "dataset_type": dataset_type,
    }

    return {
        "type": "Feature",
        "id": feat_id,
        "properties": normalized_props,
        "geometry": feature.get("geometry", {}),
    }


def _load_geojson_file(filepath: str, default_category: str) -> List[Dict[str, Any]]:
    """Read a single GeoJSON file and return its normalized features."""
    if not os.path.exists(filepath):
        logger.warning(f"Geofence file not found: {filepath}")
        return []

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        features = []
        if data.get("type") == "FeatureCollection":
            raw_features = data.get("features", [])
            for feat in raw_features:
                if feat.get("type") == "Feature":
                    features.append(_normalize_feature(feat, default_category))
        elif data.get("type") == "Feature":
            features.append(_normalize_feature(data, default_category))

        return features
    except Exception as exc:
        logger.error(f"Error loading geofence file {filepath}: {exc}")
        return []


def load_all_geofences(force_reload: bool = False, category: Optional[str] = None) -> Dict[str, Any]:
    """
    Load all geofences into an in-memory cached FeatureCollection.
    Optionally filters features by category.
    """
    global _CACHED_COLLECTION

    if _CACHED_COLLECTION is None or force_reload:
        all_features: List[Dict[str, Any]] = []
        for cat, filename in GEOFENCE_FILES.items():
            path = os.path.join(DATA_DIR, filename)
            feats = _load_geojson_file(path, cat)
            all_features.extend(feats)

        _CACHED_COLLECTION = {
            "type": "FeatureCollection",
            "name": "ORCA_Dummy_Geofences",
            "features": all_features,
            "metadata": {
                "total_features": len(all_features),
                "dataset_type": "DUMMY",
                "categories": list(GEOFENCE_CATEGORIES.keys()),
            },
        }

    if category:
        cat_clean = category.strip().lower()
        filtered_features = [
            f for f in _CACHED_COLLECTION["features"]
            if f.get("properties", {}).get("category", "").lower() == cat_clean
        ]
        return {
            "type": "FeatureCollection",
            "name": f"ORCA_Dummy_Geofences_{cat_clean}",
            "features": filtered_features,
            "metadata": {
                "total_features": len(filtered_features),
                "dataset_type": "DUMMY",
                "category_filter": cat_clean,
            },
        }

    return _CACHED_COLLECTION
