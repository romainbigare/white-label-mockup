/* GENERATED from activity.json by tools/json-to-module.py — do not edit. */
export default {
 "advice": [
  {
   "id": "adv-01",
   "farmId": "farm-1",
   "plotIds": [
    "tg-01"
   ],
   "cropName": "Date palm",
   "type": "irrigation",
   "severity": "urgent",
   "bucket": "today",
   "issuedAt": "2026-08-03T05:00:00Z",
   "ruleVersion": "irr-2026.7.3",
   "action": "Increase to 693 m³ this week",
   "amount": "231 m³ on Monday, between 6 and 8 p.m.",
   "reason": "Soil moisture is low and 44 °C is forecast Tuesday",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "693 m³ this week",
    "headlineSub": "in three waterings",
    "units": [],
    "split": [
     {
      "when": "Mon 4 Aug",
      "volume": "231 m³",
      "fromHour": 18,
      "toHour": 20
     },
     {
      "when": "Wed 6 Aug",
      "volume": "231 m³",
      "fromHour": 18,
      "toHour": 20
     },
     {
      "when": "Fri 8 Aug",
      "volume": "231 m³",
      "fromHour": 18,
      "toHour": 20
     }
    ],
    "why": [
     {
      "label": "Crop water use (ETc)",
      "value": "8.4 mm/day"
     },
     {
      "label": "Soil moisture depletion",
      "value": "42 mm since last irrigation"
     },
     {
      "label": "Available water capacity",
      "value": "120 mm"
     },
     {
      "label": "Temperature forecast",
      "value": "44 °C Tuesday"
     },
     {
      "label": "Irrigation efficiency",
      "value": "85% (drip system)"
     }
    ],
    "assumptions": null,
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": [],
    "vsUsualPct": 20,
    "efficiency": {
     "level": "good",
     "pct": 85
    },
    "watering": {
     "direction": "over",
     "pct": 15
    }
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-02",
   "farmId": "farm-1",
   "plotIds": [
    "tg-01"
   ],
   "cropName": "Date palm",
   "type": "weather",
   "severity": "action",
   "bucket": "today",
   "issuedAt": "2026-08-03T06:30:00Z",
   "ruleVersion": "weather-2026.7.2",
   "action": "Do not spray Tuesday",
   "amount": "Wind 28–34 km/h from 10:00",
   "reason": "High wind speed will reduce spray efficacy and cause drift beyond target area",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "Do not spray Tuesday",
    "headlineSub": "High wind forecast",
    "units": [
     "Wind 28–34 km/h",
     "Gusts to 40 km/h",
     "From 10:00 to 18:00"
    ],
    "split": [],
    "why": [
     {
      "label": "Wind speed",
      "value": "28–34 km/h from 10:00"
     },
     {
      "label": "Spray threshold",
      "value": "< 20 km/h recommended"
     },
     {
      "label": "Drift risk",
      "value": "High beyond field boundary"
     },
     {
      "label": "Deposit uniformity",
      "value": "Poor coverage at high wind"
     }
    ],
    "assumptions": "Standard boom sprayer · 400 L water · 3 bar pressure",
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": []
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-03",
   "farmId": "farm-1",
   "plotIds": [
    "tg-01"
   ],
   "cropName": "Date palm",
   "type": "protection",
   "severity": "urgent",
   "bucket": "today",
   "issuedAt": "2026-08-03T07:15:00Z",
   "ruleVersion": "prot-2026.7.4",
   "action": "Spray Dubas bug nymphs on fronds",
   "amount": "18 L concentrate in 360 L water",
   "reason": "Dubas bug nymphs detected on 15% of fronds; population doubling every 3 days at current temperature",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "Spray Dubas bug",
    "headlineSub": "imminent population explosion",
    "units": [
     "18 L Imidacloprid concentrate",
     "360 L water total",
     "11.2 ha plot area"
    ],
    "split": [],
    "why": [
     {
      "label": "Nymph count",
      "value": "156 per frond (15% of sample fronds)"
     },
     {
      "label": "Population doubling time",
      "value": "3 days at 40 °C"
     },
     {
      "label": "Threshold for yield loss",
      "value": "> 100 per frond"
     },
     {
      "label": "Current infestation level",
      "value": "Urgent — treat now"
     }
    ],
    "assumptions": "Drip irrigation not operating during spray",
    "activeIngredient": "Imidacloprid 200 g/L SL",
    "rate": "0.05 L/ha in 32 L water per hectare",
    "products": [
     {
      "name": "Confidor 200 SL",
      "registration": "SA-PPP-1184",
      "registrant": "Bayer CropScience"
     }
    ],
    "preHarvestIntervalDays": 21,
    "earliestSafeHarvest": "2026-08-24",
    "reentryHours": 24,
    "identification": "Dubas bug (Ommatissus lybicus) — small hemipteran, 3–4 mm, yellow nymphs with dark spots clustered on frond undersides, adults pale brown with red eyes",
    "symptoms": [
     "Yellow speckling on underside of leaflets",
     "Honeydew sooty mould on fronds and ground below",
     "Wilting and early senescence of fronds"
    ]
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-04",
   "farmId": "farm-3",
   "plotIds": [
    "plot-22"
   ],
   "cropName": "Citrus",
   "type": "irrigation",
   "severity": "action",
   "bucket": "today",
   "issuedAt": "2026-08-03T08:00:00Z",
   "ruleVersion": "irr-2026.7.3",
   "action": "Apply 448 m³ today",
   "amount": "231 m³ on Monday, between 6 and 8 p.m.",
   "reason": "Soil moisture at 62% of available capacity; citrus ET is high at this temperature",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "448 m³ today",
    "headlineSub": "at 8:00 a.m.",
    "units": [],
    "split": [
     {
      "when": "08:00–12:00",
      "volume": "448 m³",
      "fromHour": 18,
      "toHour": 20
     }
    ],
    "why": [
     {
      "label": "Soil moisture",
      "value": "62% available capacity"
     },
     {
      "label": "Evapotranspiration",
      "value": "7.2 mm/day"
     },
     {
      "label": "Refill point",
      "value": "55% soil moisture"
     },
     {
      "label": "System flow rate",
      "value": "112 m³/h"
     }
    ],
    "assumptions": null,
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": [],
    "vsUsualPct": 20,
    "efficiency": {
     "level": "good",
     "pct": 85
    },
    "watering": {
     "direction": "over",
     "pct": 15
    }
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-05",
   "farmId": "farm-2",
   "plotIds": [
    "plot-14"
   ],
   "cropName": "Alfalfa",
   "type": "nutrition",
   "severity": "action",
   "bucket": "today",
   "issuedAt": "2026-08-03T09:00:00Z",
   "ruleVersion": "nut-2026.7.1",
   "action": "Apply 50 kg/ha potassium sulphate",
   "amount": "560 kg total",
   "reason": "Tissue potassium 1.8% dry matter — below 2.0% optimum for high-yield alfalfa",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "Apply K₂SO₄",
    "headlineSub": "50 kg/ha",
    "units": [
     "560 kg K₂SO₄ total",
     "11.2 ha",
     "41% K₂O content"
    ],
    "split": [
     {
      "when": "Next irrigation",
      "volume": "560 kg granules"
     }
    ],
    "why": [
     {
      "label": "Tissue K",
      "value": "1.8% dry matter (target 2.0–2.4%)"
     },
     {
      "label": "Hay yield potential",
      "value": "15% loss at K < 1.9%"
     },
     {
      "label": "Forage digestibility",
      "value": "reduced at low K"
     },
     {
      "label": "Cutting cycle",
      "value": "4th cut — critical timing"
     }
    ],
    "assumptions": "Granular application in furrow with irrigation",
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": []
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-06",
   "farmId": "farm-1",
   "plotIds": [
    "tg-01"
   ],
   "cropName": "Date palm",
   "type": "nutrition",
   "severity": "action",
   "bucket": "week",
   "issuedAt": "2026-08-01T06:00:00Z",
   "ruleVersion": "nut-2026.7.1",
   "action": "Apply nitrogen and zinc",
   "amount": "80 kg urea + 8 kg zinc sulphate",
   "reason": "Leaf tissue nitrogen 2.1% and zinc 18 mg/kg — both trending low; nitrogen supports fruit set",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "Foliar N and Zn",
    "headlineSub": "by 9 Aug",
    "units": [
     "80 kg urea (46% N)",
     "8 kg zinc sulphate (36% Zn)",
     "2 applications 7 days apart"
    ],
    "split": [
     {
      "when": "4 Aug",
      "volume": "1,120 L spray"
     },
     {
      "when": "11 Aug",
      "volume": "1,120 L spray"
     }
    ],
    "why": [
     {
      "label": "Tissue nitrogen",
      "value": "2.1% (target 2.4–2.8%)"
     },
     {
      "label": "Tissue zinc",
      "value": "18 mg/kg (target 30–60 mg/kg)"
     },
     {
      "label": "Fruit set phase",
      "value": "critical window"
     },
     {
      "label": "Recovery time",
      "value": "7 days between applications"
     }
    ],
    "assumptions": "Foliar spray at dawn to avoid sun scorch",
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": []
   },
   "deferredUntil": null,
   "sentAt": "2026-08-03T06:20:00Z"
  },
  {
   "id": "adv-07",
   "farmId": "farm-1",
   "plotIds": [
    "tg-01"
   ],
   "cropName": "Date palm",
   "type": "protection",
   "severity": "watch",
   "bucket": "week",
   "issuedAt": "2026-08-02T05:00:00Z",
   "ruleVersion": "disease-2026.7.2",
   "action": "Monitor for dubas bug",
   "amount": "daily scouting next 5 days",
   "reason": "Conditions favour dubas bug (80%+ RH, 35–40 °C) from now to 7 Aug; early detection prevents explosion",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "Watch for dubas bug",
    "headlineSub": "next 5 days — conditions favour it",
    "units": [
     "Humidity 80–95%",
     "Temp 35–40 °C",
     "100–200 mm irrigation forecast"
    ],
    "split": [],
    "why": [
     {
      "label": "Relative humidity",
      "value": "80–95% (forecast 3–7 Aug)"
     },
     {
      "label": "Temperature range",
      "value": "35–40 °C optimal for dubas breeding"
     },
     {
      "label": "Irrigation water",
      "value": "100–200 mm — high humidity"
     },
     {
      "label": "Generation time",
      "value": "21 days nymph-to-adult at 38 °C"
     }
    ],
    "assumptions": "Weekly scouting protocol continues",
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": []
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-09",
   "farmId": "farm-3",
   "plotIds": [
    "tg-04"
   ],
   "cropName": "Lemon",
   "type": "protection",
   "severity": "watch",
   "bucket": "week",
   "issuedAt": "2026-08-01T07:00:00Z",
   "ruleVersion": "prot-2026.7.3",
   "action": "Scout for scale insects",
   "amount": "twice weekly until 15 Aug",
   "reason": "Scale insect pressure rising in hot season; adjacent plot (P-02) shows 8 per leaflet",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "Scout for scale",
    "headlineSub": "twice weekly",
    "units": [
     "8 per leaflet in adjacent plot",
     "Action threshold 5 per leaflet",
     "Scouting interval 3–4 days"
    ],
    "split": [],
    "why": [
     {
      "label": "Scale count P-02",
      "value": "8 per leaflet (adults + crawlers)"
     },
     {
      "label": "Action threshold",
      "value": "5 per leaflet"
     },
     {
      "label": "Season pressure",
      "value": "rising through hot season"
     },
     {
      "label": "Natural enemies",
      "value": "insufficient (need 3 parasitoid adults per 10 leaves)"
     }
    ],
    "assumptions": "Scouting protocol: 15 leaves per tree, 10 trees per plot",
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": []
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-10",
   "farmId": "farm-2",
   "plotIds": [
    "plot-13",
    "plot-14",
    "plot-15",
    "plot-16",
    "plot-17",
    "plot-18"
   ],
   "cropName": "Alfalfa, Wheat, Potato",
   "type": "weather",
   "severity": "watch",
   "bucket": "week",
   "issuedAt": "2026-08-02T06:00:00Z",
   "ruleVersion": "weather-2026.7.2",
   "action": "Monitor for rain 10–11 Aug",
   "amount": "10–30 mm forecast",
   "reason": "Unexpected rain during wheat flowering could reduce yield; alfalfa disease risk increases with leaf wetness",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "Monitor rain risk",
    "headlineSub": "10–11 Aug",
    "units": [
     "10–30 mm forecast",
     "Probability 60%",
     "Relative humidity 85–95%"
    ],
    "split": [],
    "why": [
     {
      "label": "Rainfall forecast",
      "value": "10–30 mm 10–11 Aug"
     },
     {
      "label": "Wheat flowering",
      "value": "critical stage — rain = fungal disease risk"
     },
     {
      "label": "Alfalfa leaf wetness",
      "value": "disease pressure (powdery mildew, rust)"
     },
     {
      "label": "Probability",
      "value": "60% from forecast model"
     }
    ],
    "assumptions": "Standard weather service forecast",
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": []
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-11",
   "farmId": "farm-1",
   "plotIds": [
    "tg-01"
   ],
   "cropName": "Date palm",
   "type": "nutrition",
   "severity": "action",
   "bucket": "later",
   "issuedAt": "2026-07-28T06:00:00Z",
   "ruleVersion": "nut-2026.6.2",
   "action": "Prune dead fronds",
   "amount": "2–3 fronds per tree",
   "reason": "Dead and brown fronds accumulate debris and reduce airflow; remove before next intensive monitoring cycle in September",
   "status": "open",
   "supersededBy": null,
   "detail": {
    "headline": "Prune dead fronds",
    "headlineSub": "before September",
    "units": [
     "2–3 fronds per tree",
     "40 trees in plot",
     "80–120 fronds total"
    ],
    "split": [],
    "why": [
     {
      "label": "Dead frond load",
      "value": "2–3 per tree"
     },
     {
      "label": "Airflow improvement",
      "value": "15–25% after pruning"
     },
     {
      "label": "Disease vector reduction",
      "value": "fungal spore spread reduced"
     },
     {
      "label": "Monitoring efficiency",
      "value": "pest scouting 20% faster with clear canopy"
     }
    ],
    "assumptions": "Manual pruning with pole saw",
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": []
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-12",
   "farmId": "farm-4",
   "plotIds": [
    "tg-06"
   ],
   "cropName": "Date palm",
   "type": "irrigation",
   "severity": "action",
   "bucket": "later",
   "issuedAt": "2026-07-26T06:00:00Z",
   "ruleVersion": "irr-2026.7.2",
   "action": "Establish baseline soil moisture profile",
   "amount": "231 m³ on Monday, between 6 and 8 p.m.",
   "reason": "New orchard requires soil profile calibration; no prior moisture data for model tuning",
   "status": "done",
   "supersededBy": null,
   "detail": {
    "headline": "Soil profiling",
    "headlineSub": "new orchard baseline",
    "units": [],
    "split": [],
    "why": [
     {
      "label": "Orchard age",
      "value": "< 60 days established"
     },
     {
      "label": "Soil type",
      "value": "not yet characterized for moisture"
     },
     {
      "label": "Irrigation model",
      "value": "requires soil-water profile"
     },
     {
      "label": "Root zone development",
      "value": "currently shallow (< 60 cm)"
     }
    ],
    "assumptions": null,
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": [],
    "vsUsualPct": 20,
    "efficiency": {
     "level": "good",
     "pct": 85
    },
    "watering": {
     "direction": "over",
     "pct": 15
    }
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-13",
   "farmId": "farm-1",
   "plotIds": [
    "tg-01"
   ],
   "cropName": "Date palm",
   "type": "nutrition",
   "severity": "watch",
   "bucket": "later",
   "issuedAt": "2026-07-29T06:00:00Z",
   "ruleVersion": "nut-2026.7.1",
   "action": "Retest nitrogen status",
   "amount": "tissue sampling 15 trees",
   "reason": "Last test 2 weeks ago showed 2.2% N; retest needed to confirm trend before applying corrective dose",
   "status": "done",
   "supersededBy": null,
   "detail": {
    "headline": "Tissue N retest",
    "headlineSub": "by 5 Aug",
    "units": [
     "15 trees sampled",
     "mid-leaflet tissue",
     "lab analysis 3 days"
    ],
    "split": [],
    "why": [
     {
      "label": "Prior tissue N",
      "value": "2.2% (21 Jul)"
     },
     {
      "label": "Target range",
      "value": "2.4–2.8%"
     },
     {
      "label": "Trend slope",
      "value": "-0.2% per 2 weeks"
     },
     {
      "label": "Application decision",
      "value": "depends on retest result"
     }
    ],
    "assumptions": "Mid-leaflet of 4th frond from apex",
    "activeIngredient": null,
    "rate": null,
    "products": [],
    "preHarvestIntervalDays": null,
    "earliestSafeHarvest": null,
    "reentryHours": null,
    "identification": null,
    "symptoms": []
   },
   "deferredUntil": null,
   "sentAt": null
  },
  {
   "id": "adv-14",
   "farmId": "farm-3",
   "plotIds": [
    "tg-03"
   ],
   "cropName": "Lemon",
   "type": "protection",
   "severity": "urgent",
   "bucket": "later",
   "issuedAt": "2026-08-02T06:30:00Z",
   "ruleVersion": "prot-2026.7.4",
   "action": "Spray for citrus leaf miner",
   "amount": "20 L concentrate + 200 L water",
   "reason": "Leaf miner mines visible in 22% of young shoots; early treatment prevents tunnel damage and defoliation",
   "status": "superseded",
   "supersededBy": "adv-03",
   "detail": {
    "headline": "Spray leaf miner",
    "headlineSub": "urgent",
    "units": [
     "20 L emamectin benzoate (1.9% EC)",
     "200 L water",
     "11.2 ha coverage"
    ],
    "split": [],
    "why": [
     {
      "label": "Leaf miner incidence",
      "value": "22% of young shoots"
     },
     {
      "label": "Mine length",
      "value": "2–5 mm (early stage)"
     },
     {
      "label": "Defoliation risk",
      "value": "60% at > 30% leaf damage"
     },
     {
      "label": "Treatment window",
      "value": "max 48 h for larvae < 2 mm"
     }
    ],
    "assumptions": "Apply at dusk to avoid heat stress",
    "activeIngredient": "Emamectin benzoate 1.9% EC",
    "rate": "0.18 L/ha in 18 L water per hectare",
    "products": [
     {
      "name": "Proclaim 1.9 EC",
      "registration": "SA-PPP-2014",
      "registrant": "Syngenta"
     }
    ],
    "preHarvestIntervalDays": 7,
    "earliestSafeHarvest": "2026-08-10",
    "reentryHours": 12,
    "identification": "Citrus leaf miner (Phyllocnistis citrella) — minute moth (4–6 mm), larva creates winding transparent mines in young leaves, pupates at mine end",
    "symptoms": [
     "Transparent winding mines in new leaves",
     "Distorted and curled leaves",
     "Defoliation in severe infestations"
    ]
   },
   "deferredUntil": null,
   "sentAt": null
  }
 ],
 "team": [
  {
   "id": "user-1",
   "initials": "KA",
   "name": "Khaled Al-Amri",
   "role": "owner",
   "phone": "+966 55 123 4567",
   "language": "English",
   "farmIds": [
    "farm-1",
    "farm-2",
    "farm-3",
    "farm-4",
    "farm-5",
    "farm-6"
   ],
   "lastActive": "2 hours ago",
   "isYou": true
  },
  {
   "id": "user-2",
   "initials": "HM",
   "name": "Hassan Mansour",
   "role": "supervisor",
   "phone": "+966 54 789 2156",
   "language": "Arabic",
   "farmIds": [
    "farm-1",
    "farm-3"
   ],
   "lastActive": "30 minutes ago",
   "isYou": false
  },
  {
   "id": "user-3",
   "initials": "AR",
   "name": "Yousef Al-Harbi",
   "role": "supervisor",
   "phone": "+91 98 7654 3210",
   "language": "Arabic",
   "farmIds": [
    "farm-2",
    "farm-4",
    "farm-5",
    "farm-6"
   ],
   "lastActive": "1 hour ago",
   "isYou": false
  }
 ],
 "activityLog": [
  {
   "id": "log-01",
   "at": "2026-08-03T10:15:00Z",
   "actorId": "user-2",
   "actorName": "Hassan Mansour",
   "farmId": "farm-1",
   "category": "advice",
   "text": "Sent \"Irrigate the date palms\" to Hassan Mansour"
  },
  {
   "id": "log-02",
   "at": "2026-08-03T09:45:00Z",
   "actorId": "user-3",
   "actorName": "Ahmed Rahman",
   "farmId": "farm-1",
   "category": "advice",
   "text": "Recorded work against \"Apply nitrogen and zinc\" — 1,120 L spray prepared"
  },
  {
   "id": "log-03",
   "at": "2026-08-02T16:20:00Z",
   "actorId": "user-4",
   "actorName": "Bilal Haq",
   "farmId": "farm-1",
   "category": "advice",
   "text": "Recorded work against \"Prune dead fronds\" — 98 fronds removed"
  },
  {
   "id": "log-04",
   "at": "2026-08-02T14:30:00Z",
   "actorId": "user-2",
   "actorName": "Hassan Mansour",
   "farmId": "farm-1",
   "category": "advice",
   "text": "Acknowledged urgent protection advice adv-03 for Dubas bug on P-01"
  },
  {
   "id": "log-05",
   "at": "2026-08-02T11:50:00Z",
   "actorId": "user-1",
   "actorName": "Khaled Al-Amri",
   "farmId": "farm-4",
   "category": "advice",
   "text": "Recorded work against \"Complete soil profiling\" — samples sent to lab"
  },
  {
   "id": "log-06",
   "at": "2026-08-01T17:05:00Z",
   "actorId": "user-3",
   "actorName": "Ahmed Rahman",
   "farmId": "farm-1",
   "category": "advice",
   "text": "Recorded work against \"Retest nitrogen\" — samples submitted to Riyadh lab"
  },
  {
   "id": "log-07",
   "at": "2026-07-31T20:10:00Z",
   "actorId": "user-2",
   "actorName": "Hassan Mansour",
   "farmId": "farm-1",
   "category": "cropcycle",
   "text": "Updated crop cycle for P-09 — date palm + alfalfa intercropping logged"
  },
  {
   "id": "log-08",
   "at": "2026-07-31T08:15:00Z",
   "actorId": "user-2",
   "actorName": "Hassan Mansour",
   "farmId": "farm-3",
   "category": "boundary",
   "text": "Updated field boundary for plot P-02 (plot-20) — corrected GPS coordinates"
  },
  {
   "id": "log-09",
   "at": "2026-07-30T14:45:00Z",
   "actorId": "user-1",
   "actorName": "Khaled Al-Amri",
   "farmId": "farm-1",
   "category": "member",
   "text": "Made Hassan Mansour the supervisor of farm-1"
  },
  {
   "id": "log-10",
   "at": "2026-07-29T18:30:00Z",
   "actorId": "user-2",
   "actorName": "Hassan Mansour",
   "farmId": "farm-1",
   "category": "input",
   "text": "Logged irrigation input: 693 m³ applied to P-04 on 28 Jul — drip system 6h 20m"
  },
  {
   "id": "log-11",
   "at": "2026-07-28T16:00:00Z",
   "actorId": "user-4",
   "actorName": "Bilal Haq",
   "farmId": "farm-1",
   "category": "observation",
   "text": "Logged observation: Dubas bug nymphs found on P-01 fronds east edge — photo uploaded"
  },
  {
   "id": "log-12",
   "at": "2026-07-27T11:25:00Z",
   "actorId": "user-1",
   "actorName": "Khaled Al-Amri",
   "farmId": "farm-2",
   "category": "role",
   "text": "Changed Hassan Mansour's role on farm-2 to member (was supervisor)"
  },
  {
   "id": "log-13",
   "at": "2026-07-26T19:40:00Z",
   "actorId": "user-2",
   "actorName": "Hassan Mansour",
   "farmId": "farm-3",
   "category": "advice",
   "text": "Created advice \"Irrigate P-22 (farm-3)\" assigned to self"
  },
  {
   "id": "log-14",
   "at": "2026-07-25T09:55:00Z",
   "actorId": "user-1",
   "actorName": "Khaled Al-Amri",
   "farmId": "farm-1",
   "category": "subscription",
   "text": "Upgraded subscription plan to Advanced — full analytics and AI features enabled"
  },
  {
   "id": "log-15",
   "at": "2026-07-24T14:20:00Z",
   "actorId": "user-3",
   "actorName": "Ahmed Rahman",
   "farmId": "farm-1",
   "category": "input",
   "text": "Logged fertiliser application: 50 kg urea per hectare on P-07 — foliage spray"
  },
  {
   "id": "log-16",
   "at": "2026-07-22T12:30:00Z",
   "actorId": "user-2",
   "actorName": "Hassan Mansour",
   "farmId": "farm-3",
   "category": "input",
   "text": "Logged pest control: Imidacloprid spray on P-03 against scale insects — 11.2 ha covered"
  },
  {
   "id": "log-17",
   "at": "2026-07-20T08:45:00Z",
   "actorId": "user-5",
   "actorName": "Anwar Hossain",
   "farmId": "farm-2",
   "category": "input",
   "text": "Logged irrigation: 350 m³ on P-02 (plot-14) — alfalfa 4th cut cycle"
  },
  {
   "id": "log-18",
   "at": "2026-07-18T15:10:00Z",
   "actorId": "user-1",
   "actorName": "Khaled Al-Amri",
   "farmId": "farm-4",
   "category": "member",
   "text": "Removed Ahmed Rahman from farm-4 team"
  },
  {
   "id": "log-19",
   "at": "2026-07-16T10:00:00Z",
   "actorId": "user-2",
   "actorName": "Hassan Mansour",
   "farmId": "farm-1",
   "category": "cropcycle",
   "text": "Marked P-03 as ready for harvest — bunches at target Brix 18"
  },
  {
   "id": "log-20",
   "at": "2026-07-12T13:50:00Z",
   "actorId": "user-1",
   "actorName": "Khaled Al-Amri",
   "farmId": "farm-2",
   "category": "boundary",
   "text": "Added new plot boundary P-06 (plot-18) — 11.2 ha potato field"
  }
 ],
 "reports": [
  {
   "id": "rep-01",
   "farmId": "farm-1",
   "kind": "weekly",
   "title": "Weekly farm report",
   "period": "Week 31 · 27 Jul – 2 Aug",
   "state": "ready",
   "requiredPlan": null,
   "sizeKb": 840
  },
  {
   "id": "rep-02",
   "farmId": "farm-1",
   "kind": "weekly",
   "title": "Weekly farm report",
   "period": "Week 30 · 20 Jul – 26 Jul",
   "state": "ready",
   "requiredPlan": null,
   "sizeKb": 750
  },
  {
   "id": "rep-03",
   "farmId": "farm-1",
   "kind": "weekly",
   "title": "Weekly farm report",
   "period": "Week 29 · 13 Jul – 19 Jul",
   "state": "ready",
   "requiredPlan": null,
   "sizeKb": 820
  },
  {
   "id": "rep-04",
   "farmId": "farm-1",
   "kind": "weekly",
   "title": "Weekly farm report",
   "period": "Week 28 · 6 Jul – 12 Jul",
   "state": "ready",
   "requiredPlan": null,
   "sizeKb": 680
  },
  {
   "id": "rep-05",
   "farmId": "farm-1",
   "kind": "monthly",
   "title": "Monthly farm report",
   "period": "July 2026",
   "state": "locked",
   "requiredPlan": "Advanced",
   "sizeKb": 2100
  },
  {
   "id": "rep-06",
   "farmId": "farm-1",
   "kind": "weekly",
   "title": "Tree health summary",
   "period": "Week 31 · 27 Jul – 2 Aug",
   "state": "ready",
   "requiredPlan": null,
   "sizeKb": 1240
  }
 ],
 "observations": [
  {
   "id": "obs-01",
   "farmId": "farm-1",
   "plotId": "plot-04",
   "category": "pest",
   "severity": "high",
   "note": "Dubas bug nymphs on the underside of fronds, east edge. Clusters visible, orange colour.",
   "at": "2026-07-28T07:40:00Z",
   "byId": "user-4",
   "photoCount": 2,
   "lat": 24.157,
   "lon": 47.301,
   "aiIdentification": {
    "name": "Dubas bug (Ommatissus lybicus)",
    "confidence": 0.78,
    "accepted": true
   }
  },
  {
   "id": "obs-02",
   "farmId": "farm-1",
   "plotId": "plot-07",
   "category": "water",
   "severity": "medium",
   "note": "Soil moisture at 65% available water capacity. Drip lines functioning normally.",
   "at": "2026-07-29T06:15:00Z",
   "byId": "user-3",
   "photoCount": 0,
   "lat": 24.164,
   "lon": 47.315,
   "aiIdentification": null
  },
  {
   "id": "obs-03",
   "farmId": "farm-3",
   "plotId": "plot-20",
   "category": "disease",
   "severity": "low",
   "note": "Minor scale insect crawlers on lemon leaves. Count 2 per leaflet on sample. Not yet at action threshold.",
   "at": "2026-07-30T08:20:00Z",
   "byId": "user-2",
   "photoCount": 1,
   "lat": 25.287,
   "lon": 46.902,
   "aiIdentification": {
    "name": "Scale insect (Parlatoria pergandii)",
    "confidence": 0.62,
    "accepted": false
   }
  },
  {
   "id": "obs-04",
   "farmId": "farm-2",
   "plotId": "plot-14",
   "category": "damage",
   "severity": "high",
   "note": "Pump motor failure. No irrigation possible. Field will dry rapidly at 40 °C. Maintenance urgent.",
   "at": "2026-08-01T09:30:00Z",
   "byId": "user-5",
   "photoCount": 1,
   "lat": 31.724,
   "lon": 35.834,
   "aiIdentification": null
  },
  {
   "id": "obs-05",
   "farmId": "farm-1",
   "plotId": "plot-09",
   "category": "other",
   "severity": "low",
   "note": "Intercropping check: date palms 8.5 m tall, alfalfa 35 cm, no competition visible at 3 months.",
   "at": "2026-08-02T07:10:00Z",
   "byId": "user-3",
   "photoCount": 2,
   "lat": 24.161,
   "lon": 47.308,
   "aiIdentification": null
  },
  {
   "id": "obs-06",
   "farmId": "farm-4",
   "plotId": "plot-29",
   "category": "water",
   "severity": "medium",
   "note": "New orchard establishment. Trees 90 cm height. Drip irrigation installed but not yet calibrated. Awaiting soil profile analysis.",
   "at": "2026-08-02T14:45:00Z",
   "byId": "user-2",
   "photoCount": 1,
   "lat": 22.569,
   "lon": 59.539,
   "aiIdentification": null
  }
 ]
};
