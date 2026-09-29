# Neo4j Transfer-Pricing Graph

This is the demo graph for the Novatek group. It turns the mock transaction export, functional profiles, compliance rules, financials, and comparable sets into a traceable analysis graph.

```mermaid
flowchart LR
    US["Novatek Holdings Inc.<br/>US parent / entrepreneur"]
    IN["Novatek Technologies India<br/>Captive software services"]
    CH["Novatek Supply Services AG<br/>Swiss procurement services"]
    MX["Novatek Manufactura de Mexico<br/>Contract manufacturer / maquila"]
    DE["Novatek Vertrieb GmbH<br/>Limited-risk distributor"]

    IN -->|"Software development<br/>cost plus 15%"| US
    CH -->|"Procurement services<br/>cost plus 5%"| US
    CH -->|"Procurement services<br/>cost plus 5%"| MX
    CH -->|"Procurement services<br/>cost plus 5%"| DE
    MX -->|"Contract manufacturing<br/>cost plus 6.5%"| US
    US -->|"Finished products<br/>resale-minus OM 2-4%"| DE
    US -->|"Term-loan interest<br/>2.0%"| MX
    US -->|"Management services"| IN
    US -->|"Trademark and technology royalty"| DE

    OECD["OECD / BEPS rules"]
    USRule["US CPM / documentation rules"]
    INRule["India TP documentation and benefit-test rules"]
    MXRule["Mexico maquila safe-harbor rule"]
    DERule["Germany documentation rule"]

    OECD -. triggers / cites .-> IN
    OECD -. triggers / cites .-> MX
    OECD -. triggers / cites .-> DE
    USRule -. applies to .-> US
    INRule -. applies to .-> IN
    MXRule -. applies to .-> MX
    DERule -. applies to .-> DE

    FAR["Approved FAR assessment"]
    Method["TNMM / CPM recommendation<br/>tested party + PLI"]
    Comps["Comparable-company screening"]
    Benchmark["3-year weighted IQR<br/>median adjustment"]
    Report["Cited local-file benchmark draft"]

    MX --> FAR --> Method --> Comps --> Benchmark --> Report
    OECD -. citations .-> Report
    MXRule -. citations .-> Report
```

## Graph semantics

- `LegalEntity` nodes represent group companies with jurisdiction, functional profile, assets, risks, and tested-party attributes.
- `INTERCOMPANY_TRANSACTION` relationships represent the recorded flow between legal entities and retain transaction facts on the relationship.
- `TPRule` nodes are linked to entities and transactions when their conditions apply; every rule carries a source citation and illustrative-data flag.
- `FinancialResult`, `Comparable`, `FARAssessment`, `Benchmark`, `Citation`, and `AuditEvent` nodes support the reviewable TNMM workflow described in the PRD.
- A conclusion must be traceable from the benchmark back to selected comparables, approved FAR facts, intercompany transactions, and regulation rules.
