FEATURE_NAMES = [
    "transactionAmount",
    "totalIn24h",
    "totalOut24h",
    "velocityScore",
    "burstScore",
    "uniqueCounterparties7d",
    "avgAmountDeviation",
    "ja3ReuseCount",
    "deviceReuseCount",
    "ipReuseCount",
    "geoMismatch"
]


def build_feature_vector(req):

    b = req.behaviorFeatures
    i = req.identityFeatures

    return [
        req.transactionAmount,
        b.totalIn24h,
        b.totalOut24h,
        b.velocityScore,
        b.burstScore,
        b.uniqueCounterparties7d,
        b.avgAmountDeviation,
        i.ja3ReuseCount,
        i.deviceReuseCount,
        i.ipReuseCount,
        int(i.geoMismatch)
    ]