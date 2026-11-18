### Load test: 1 → 5 → 10 → 20 concurrent users, 20s per stage, 1200 issues

| Users | Requests | Req/s | p50 ms | p95 ms | p99 ms | Max ms | Errors | API CPU avg/max | API RAM max | DB CPU avg | DB RAM max |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2885 | 144.3 | 7 | 13 | 18 | 238 | 0.00 % | 32 % / 38 % | 221 MB | 36 % | 113 MB |
| 5 | 6139 | 306.9 | 15 | 32 | 49 | 279 | 0.00 % | 74 % / 84 % | 220 MB | 109 % | 133 MB |
| 10 | 6027 | 301.4 | 31 | 68 | 112 | 371 | 0.00 % | 83 % / 92 % | 212 MB | 134 % | 139 MB |
| 20 | 5325 | 266.3 | 73 | 156 | 340 | 518 | 0.00 % | 84 % / 93 % | 228 MB | 131 % | 138 MB |

#### Per endpoint at 20 users

| Endpoint | Requests | p50 ms | p95 ms | Max ms | Errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| issues.create | 241 | 143 | 263 | 518 | 0 |
| issues.getByIdentifier | 1271 | 93 | 169 | 411 | 0 |
| issues.list | 1271 | 73 | 141 | 383 | 0 |
| issues.list (search) | 1271 | 77 | 135 | 393 | 0 |
| me.get | 1271 | 21 | 37 | 284 | 0 |

SLO at 20 users: p95 < 500 ms and errors < 1 %. CPU is % of one core.
**Result: SLO met.**
