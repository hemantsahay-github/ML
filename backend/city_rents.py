"""Curated ongoing-rent and per-sqft-rate data for Indian tier-1 micro-markets.

Each row: city, area, type (flat/villa), bhk, rent/psf ranges, rental_yield.
Values reflect ~Q1-2026 market observations and are intended for directional guidance
(not appraisal). Users can also contribute via /api/market/contribute.
"""

MARKET_DATA = [
    # Bengaluru
    {"city": "Bengaluru", "area": "Whitefield", "type": "flat", "bhk": "2BHK",
     "rent_min": 32000, "rent_avg": 40000, "rent_max": 52000,
     "psf_min": 9500, "psf_avg": 11500, "psf_max": 14500, "rental_yield_pct": 3.6},
    {"city": "Bengaluru", "area": "Whitefield", "type": "flat", "bhk": "3BHK",
     "rent_min": 45000, "rent_avg": 58000, "rent_max": 78000,
     "psf_min": 10500, "psf_avg": 12500, "psf_max": 15500, "rental_yield_pct": 3.3},
    {"city": "Bengaluru", "area": "Sarjapur Road", "type": "flat", "bhk": "2BHK",
     "rent_min": 28000, "rent_avg": 36000, "rent_max": 48000,
     "psf_min": 8500, "psf_avg": 10800, "psf_max": 13500, "rental_yield_pct": 3.4},
    {"city": "Bengaluru", "area": "Sarjapur Road", "type": "flat", "bhk": "3BHK",
     "rent_min": 42000, "rent_avg": 54000, "rent_max": 72000,
     "psf_min": 9200, "psf_avg": 11800, "psf_max": 14500, "rental_yield_pct": 3.1},
    {"city": "Bengaluru", "area": "Indiranagar", "type": "flat", "bhk": "2BHK",
     "rent_min": 42000, "rent_avg": 55000, "rent_max": 75000,
     "psf_min": 14000, "psf_avg": 17500, "psf_max": 22000, "rental_yield_pct": 2.9},
    {"city": "Bengaluru", "area": "Indiranagar", "type": "flat", "bhk": "3BHK",
     "rent_min": 65000, "rent_avg": 85000, "rent_max": 1_20_000,
     "psf_min": 15000, "psf_avg": 18500, "psf_max": 23000, "rental_yield_pct": 2.7},
    {"city": "Bengaluru", "area": "Koramangala", "type": "flat", "bhk": "2BHK",
     "rent_min": 45000, "rent_avg": 58000, "rent_max": 80000,
     "psf_min": 15000, "psf_avg": 18500, "psf_max": 24000, "rental_yield_pct": 2.8},
    {"city": "Bengaluru", "area": "HSR Layout", "type": "flat", "bhk": "2BHK",
     "rent_min": 38000, "rent_avg": 48000, "rent_max": 62000,
     "psf_min": 12000, "psf_avg": 14500, "psf_max": 17500, "rental_yield_pct": 3.2},
    {"city": "Bengaluru", "area": "Devanahalli", "type": "flat", "bhk": "2BHK",
     "rent_min": 18000, "rent_avg": 24000, "rent_max": 32000,
     "psf_min": 6500, "psf_avg": 8200, "psf_max": 10500, "rental_yield_pct": 3.6},

    # Mumbai
    {"city": "Mumbai", "area": "Borivali East", "type": "flat", "bhk": "2BHK",
     "rent_min": 45000, "rent_avg": 58000, "rent_max": 78000,
     "psf_min": 22000, "psf_avg": 27500, "psf_max": 35000, "rental_yield_pct": 2.3},
    {"city": "Mumbai", "area": "Worli", "type": "flat", "bhk": "3BHK",
     "rent_min": 2_20_000, "rent_avg": 3_00_000, "rent_max": 5_00_000,
     "psf_min": 55000, "psf_avg": 68000, "psf_max": 95000, "rental_yield_pct": 1.8},
    {"city": "Mumbai", "area": "Panvel", "type": "flat", "bhk": "2BHK",
     "rent_min": 22000, "rent_avg": 28000, "rent_max": 36000,
     "psf_min": 7800, "psf_avg": 10000, "psf_max": 12800, "rental_yield_pct": 3.2},
    {"city": "Mumbai", "area": "Thane West", "type": "flat", "bhk": "2BHK",
     "rent_min": 32000, "rent_avg": 42000, "rent_max": 55000,
     "psf_min": 13500, "psf_avg": 16500, "psf_max": 20000, "rental_yield_pct": 2.8},

    # Delhi NCR
    {"city": "Delhi NCR", "area": "Dwarka Expressway", "type": "flat", "bhk": "3BHK",
     "rent_min": 35000, "rent_avg": 48000, "rent_max": 65000,
     "psf_min": 12000, "psf_avg": 15500, "psf_max": 19500, "rental_yield_pct": 2.6},
    {"city": "Delhi NCR", "area": "Sector 146 Noida", "type": "flat", "bhk": "3BHK",
     "rent_min": 30000, "rent_avg": 40000, "rent_max": 55000,
     "psf_min": 10500, "psf_avg": 13500, "psf_max": 17000, "rental_yield_pct": 2.8},
    {"city": "Delhi NCR", "area": "Gurgaon Golf Course Road", "type": "flat", "bhk": "3BHK",
     "rent_min": 80000, "rent_avg": 1_10_000, "rent_max": 1_80_000,
     "psf_min": 18000, "psf_avg": 23000, "psf_max": 32000, "rental_yield_pct": 2.4},

    # Hyderabad
    {"city": "Hyderabad", "area": "Kokapet", "type": "flat", "bhk": "3BHK",
     "rent_min": 35000, "rent_avg": 48000, "rent_max": 65000,
     "psf_min": 8500, "psf_avg": 10500, "psf_max": 13000, "rental_yield_pct": 3.4},
    {"city": "Hyderabad", "area": "Gachibowli", "type": "flat", "bhk": "3BHK",
     "rent_min": 42000, "rent_avg": 55000, "rent_max": 75000,
     "psf_min": 9800, "psf_avg": 11800, "psf_max": 14500, "rental_yield_pct": 3.2},
    {"city": "Hyderabad", "area": "HITEC City", "type": "flat", "bhk": "2BHK",
     "rent_min": 30000, "rent_avg": 40000, "rent_max": 55000,
     "psf_min": 10500, "psf_avg": 13000, "psf_max": 16000, "rental_yield_pct": 3.1},

    # Pune
    {"city": "Pune", "area": "Hinjewadi", "type": "flat", "bhk": "2BHK",
     "rent_min": 22000, "rent_avg": 30000, "rent_max": 42000,
     "psf_min": 8500, "psf_avg": 11000, "psf_max": 13500, "rental_yield_pct": 3.3},
    {"city": "Pune", "area": "Kharadi", "type": "flat", "bhk": "3BHK",
     "rent_min": 40000, "rent_avg": 52000, "rent_max": 70000,
     "psf_min": 11000, "psf_avg": 13500, "psf_max": 17500, "rental_yield_pct": 3.0},
    {"city": "Pune", "area": "Koregaon Park", "type": "flat", "bhk": "2BHK",
     "rent_min": 48000, "rent_avg": 62000, "rent_max": 85000,
     "psf_min": 16000, "psf_avg": 19500, "psf_max": 24000, "rental_yield_pct": 2.8},

    # Chennai
    {"city": "Chennai", "area": "OMR Padur", "type": "flat", "bhk": "2BHK",
     "rent_min": 18000, "rent_avg": 24000, "rent_max": 32000,
     "psf_min": 6800, "psf_avg": 8500, "psf_max": 10500, "rental_yield_pct": 3.2},
    {"city": "Chennai", "area": "Porur", "type": "flat", "bhk": "2BHK",
     "rent_min": 22000, "rent_avg": 30000, "rent_max": 40000,
     "psf_min": 7500, "psf_avg": 9200, "psf_max": 11500, "rental_yield_pct": 3.4},

    # Kolkata
    {"city": "Kolkata", "area": "New Town Rajarhat", "type": "flat", "bhk": "2BHK",
     "rent_min": 15000, "rent_avg": 20000, "rent_max": 28000,
     "psf_min": 5500, "psf_avg": 6800, "psf_max": 8500, "rental_yield_pct": 3.2},

    # Ahmedabad
    {"city": "Ahmedabad", "area": "SG Highway", "type": "flat", "bhk": "3BHK",
     "rent_min": 25000, "rent_avg": 33000, "rent_max": 45000,
     "psf_min": 7000, "psf_avg": 8800, "psf_max": 11000, "rental_yield_pct": 3.3},
]
