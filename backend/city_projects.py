"""Curated upcoming residential projects across Indian tier-1 cities.

This is a static dataset used by the /api/builder-projects endpoint.
It is deliberately kept small and representative — for a real launch we'd
replace this with a live feed (RERA APIs per state, or a scraping pipeline).

Each project carries:
  id, city, area, name, builder, status, possession (YYYY-MM), config,
  price_from_inr (ticket size entry), price_per_sqft, amenities, rera_id
"""

UPCOMING_PROJECTS = [
    # Bengaluru
    {"id": "blr-whitefield-prestige-park-grove", "city": "Bengaluru", "area": "Whitefield", "name": "Prestige Park Grove",
     "builder": "Prestige Group", "status": "Under construction", "possession": "2027-06",
     "config": "2/3/4 BHK", "price_from_inr": 19500000, "price_per_sqft": 13500,
     "amenities": ["Clubhouse", "Pool", "Olympic-size lap pool", "Sports arena"], "rera_id": "PRM/KA/RERA/1251/446/PR/240110/006700",
     "lat": 12.9698, "lng": 77.7500, "highlight": "Nearest IT parks 5 km; metro phase 2B opening 2026."},
    {"id": "blr-sarjapur-brigade-oasis", "city": "Bengaluru", "area": "Sarjapur Road", "name": "Brigade Oasis",
     "builder": "Brigade Group", "status": "Upcoming", "possession": "2028-12",
     "config": "3/4 BHK Villas", "price_from_inr": 32500000, "price_per_sqft": 12800,
     "amenities": ["Private gardens", "Clubhouse", "Tennis courts"], "rera_id": "RERA pending",
     "lat": 12.9010, "lng": 77.7600, "highlight": "Low-rise villa plot development; tree-heavy design."},
    {"id": "blr-devanahalli-godrej-splendour", "city": "Bengaluru", "area": "Devanahalli", "name": "Godrej Splendour",
     "builder": "Godrej Properties", "status": "Under construction", "possession": "2027-03",
     "config": "2/3 BHK", "price_from_inr": 11200000, "price_per_sqft": 7900,
     "amenities": ["Clubhouse", "Pool", "EV charging"], "rera_id": "PRM/KA/RERA/1250/303/PR/231115/005621",
     "lat": 13.2510, "lng": 77.7080, "highlight": "Airport corridor; strong land appreciation since 2022."},

    # Mumbai
    {"id": "mum-borivali-oberoi-sky-city", "city": "Mumbai", "area": "Borivali East", "name": "Oberoi Sky City",
     "builder": "Oberoi Realty", "status": "Under construction", "possession": "2026-12",
     "config": "2/3/4 BHK", "price_from_inr": 28500000, "price_per_sqft": 28000,
     "amenities": ["Sky lounge", "Pool", "Spa", "Concierge"], "rera_id": "P51800020385",
     "lat": 19.2290, "lng": 72.8580, "highlight": "Metro Line 2A stop at doorstep; SGNP views."},
    {"id": "mum-worli-lodha-worli", "city": "Mumbai", "area": "Worli", "name": "Lodha Worli",
     "builder": "Lodha Group", "status": "Upcoming", "possession": "2028-06",
     "config": "3/4/5 BHK", "price_from_inr": 85000000, "price_per_sqft": 62000,
     "amenities": ["Sea-facing", "Private elevators", "Helipad"], "rera_id": "RERA pending",
     "lat": 19.0176, "lng": 72.8150, "highlight": "Ultra-luxury sea-facing; coastal road connectivity."},
    {"id": "mum-panvel-hiranandani-fortune-city", "city": "Mumbai", "area": "Panvel", "name": "Hiranandani Fortune City",
     "builder": "Hiranandani Communities", "status": "Under construction", "possession": "2027-09",
     "config": "1/2/3 BHK", "price_from_inr": 8200000, "price_per_sqft": 9800,
     "amenities": ["Township", "Pool", "Schools onsite"], "rera_id": "P52000040116",
     "lat": 18.9894, "lng": 73.1175, "highlight": "Navi Mumbai Airport + Mumbai-Pune expressway."},

    # Delhi NCR
    {"id": "ncr-dwarka-dlf-privana", "city": "Delhi NCR", "area": "Dwarka Expressway", "name": "DLF Privana South",
     "builder": "DLF", "status": "Under construction", "possession": "2027-06",
     "config": "4 BHK", "price_from_inr": 52000000, "price_per_sqft": 17500,
     "amenities": ["Clubhouse", "Spa", "Forest trails"], "rera_id": "RC/REP/HARERA/GGM/720/452/2023/79",
     "lat": 28.4580, "lng": 77.0390, "highlight": "Aravalli-facing; expressway-ready in 2026."},
    {"id": "ncr-noida-godrej-tropical-isle", "city": "Delhi NCR", "area": "Sector 146 Noida", "name": "Godrej Tropical Isle",
     "builder": "Godrej Properties", "status": "Upcoming", "possession": "2028-03",
     "config": "3/4 BHK", "price_from_inr": 26500000, "price_per_sqft": 14200,
     "amenities": ["Pool", "Clubhouse", "Sports turf"], "rera_id": "UPRERAPRJ pending",
     "lat": 28.4310, "lng": 77.5220, "highlight": "FNG-E corridor; near Jewar airport."},

    # Hyderabad
    {"id": "hyd-kokapet-my-home-tridasa", "city": "Hyderabad", "area": "Kokapet", "name": "My Home Tridasa",
     "builder": "My Home Group", "status": "Under construction", "possession": "2027-12",
     "config": "3/4 BHK", "price_from_inr": 22500000, "price_per_sqft": 10500,
     "amenities": ["40k sqft clubhouse", "Pools", "Multiplex"], "rera_id": "P02400004891",
     "lat": 17.4080, "lng": 78.3370, "highlight": "Financial District spillover; HMDA roads ready."},
    {"id": "hyd-gachibowli-aparna-sarovar-zenith", "city": "Hyderabad", "area": "Gachibowli", "name": "Aparna Sarovar Zenith",
     "builder": "Aparna Constructions", "status": "Upcoming", "possession": "2028-09",
     "config": "3/4 BHK", "price_from_inr": 28500000, "price_per_sqft": 11800,
     "amenities": ["Sky clubs", "Wellness center", "Library"], "rera_id": "RERA pending",
     "lat": 17.4401, "lng": 78.3489, "highlight": "IT corridor epicentre; metro phase 2."},

    # Pune
    {"id": "pune-hinjewadi-kolte-24k-altura", "city": "Pune", "area": "Hinjewadi", "name": "Kolte 24K Altura",
     "builder": "Kolte Patil", "status": "Under construction", "possession": "2027-03",
     "config": "3/4 BHK", "price_from_inr": 16500000, "price_per_sqft": 11200,
     "amenities": ["Rooftop pool", "Co-working", "Pet park"], "rera_id": "P52100050312",
     "lat": 18.5920, "lng": 73.7380, "highlight": "IT corridor; proposed metro 2027."},
    {"id": "pune-kharadi-panchshil-trump-towers-2", "city": "Pune", "area": "Kharadi", "name": "Panchshil Trump Towers II",
     "builder": "Panchshil Realty", "status": "Upcoming", "possession": "2029-06",
     "config": "4/5 BHK", "price_from_inr": 65000000, "price_per_sqft": 22500,
     "amenities": ["Concierge", "Private elevator", "Sky lounge"], "rera_id": "RERA pending",
     "lat": 18.5520, "lng": 73.9390, "highlight": "EON IT park adjacency; airport 15 min."},

    # Chennai
    {"id": "chn-omr-casagrand-utsav", "city": "Chennai", "area": "OMR Padur", "name": "Casagrand Utsav",
     "builder": "Casagrand", "status": "Under construction", "possession": "2027-06",
     "config": "2/3 BHK", "price_from_inr": 9200000, "price_per_sqft": 7400,
     "amenities": ["Clubhouse", "Pool", "Amphitheatre"], "rera_id": "TN/29/Building/0148/2024",
     "lat": 12.8850, "lng": 80.2260, "highlight": "Siruseri IT park 4 km; budget-to-premium mix."},
    {"id": "chn-porur-alliance-humming-gardens", "city": "Chennai", "area": "Porur", "name": "Alliance Humming Gardens",
     "builder": "Alliance Group", "status": "Upcoming", "possession": "2028-03",
     "config": "2/3 BHK", "price_from_inr": 11500000, "price_per_sqft": 8100,
     "amenities": ["Themed gardens", "Sports academy"], "rera_id": "RERA pending",
     "lat": 13.0370, "lng": 80.1580, "highlight": "Chennai Bypass + Metro phase 2."},

    # Kolkata
    {"id": "kol-rajarhat-merlin-rise", "city": "Kolkata", "area": "New Town Rajarhat", "name": "Merlin Rise",
     "builder": "Merlin Group", "status": "Under construction", "possession": "2027-03",
     "config": "2/3 BHK", "price_from_inr": 6800000, "price_per_sqft": 6100,
     "amenities": ["Clubhouse", "Pool", "Skating rink"], "rera_id": "HIRA/P/NOR/2024/001402",
     "lat": 22.5820, "lng": 88.4630, "highlight": "ECOspace/Sector V commute <20min."},

    # Ahmedabad
    {"id": "amd-sg-highway-adani-shantigram", "city": "Ahmedabad", "area": "SG Highway", "name": "Adani Shantigram — The Links",
     "builder": "Adani Realty", "status": "Under construction", "possession": "2027-06",
     "config": "3/4 BHK", "price_from_inr": 13500000, "price_per_sqft": 7800,
     "amenities": ["Golf course", "Clubhouse", "Retail spine"], "rera_id": "PR/GJ/AHMEDABAD/AHMEDABAD CITY/AUDA/MAA10562/141123",
     "lat": 23.0780, "lng": 72.4920, "highlight": "600-acre township; SG highway access."},
]
