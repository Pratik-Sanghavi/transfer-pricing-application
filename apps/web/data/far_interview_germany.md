# FAR Interview: Novatek Vertrieb GmbH (Germany)

**Participants:** Katrin Weber, CFO Novatek Vertrieb GmbH (fictional) · TP Consultant
**Length:** ~2.5 minutes · **Use:** read aloud and record with PLAUD, or paste the transcript straight into the FAR-extraction prompt.

---

**Consultant:** Thanks for making time, Katrin. Can you start with what the German entity actually does day to day?

**Katrin:** Sure. We're the sales arm for EMEA. We buy finished sensors from Novatek Holdings in the US and resell them to industrial customers, mostly OEMs in Germany, Austria and the Nordics. About 210 people now: sales, customer service, a small warehouse team and finance.

**Consultant:** Who decides pricing to customers and the marketing strategy?

**Katrin:** Price lists come from Dallas. We can discount up to 8% on our own; anything above that needs HQ approval. Marketing strategy, brand guidelines and product launches are all run from the US. We execute locally: trade shows, customer events. Last year we did hire two local marketing people who run our trade-show calendar, but they follow the US campaign plan.

**Consultant:** Do you do any product development or engineering?

**Katrin:** No. No R&D here at all. We give customer feedback to the US product team, but the designs and patents are theirs.

**Consultant:** Let's talk about risk. Inventory first. What happens with slow-moving or obsolete stock?

**Katrin:** We hold about 45 days of stock. If something becomes obsolete, HQ takes it back at cost. That's in the distribution agreement from 2017.

**Consultant:** And customer credit risk?

**Katrin:** That's ours. We run credit checks, but bad debts hit our P&L. Historically it's tiny, well under half a percent of sales.

**Consultant:** Currency? You buy from the US in dollars.

**Katrin:** We're invoiced in dollars, yes. But HQ does a quarterly true-up so we land in a 2 to 4% operating margin. That's the whole model: we're supposed to earn a stable, low return.

**Consultant:** So why is there a loss in FY2025?

**Katrin:** Two things. Margins were already squeezed in 2024. Then, starting January 2025, HQ began charging a royalty of 3% of net sales for the trademark and the technology. Nobody sent us a signed licence agreement; we just started receiving invoices. And the true-up that should have brought us back to the target margin didn't account for the royalty, so we ended the year negative.

**Consultant:** Did anything change in what Germany does, or the value it gets from the brand, when the royalty started?

**Katrin:** Honestly, no. Same functions, same customers, same brand usage as before. We just pay for it now.

**Consultant:** Assets. Any significant owned assets?

**Katrin:** Leased office and leased warehouse, IT equipment, and the customer relationships our team manages. No patents, no trademarks registered in our name.

**Consultant:** Very helpful. Thank you, Katrin.

---

## Answer key: expected FAR extraction
*(use to check the LLM output, or as a fallback if the live call fails)*

```json
{
  "entity_id": "E05",
  "characterisation": "Limited-risk distributor",
  "functions": {
    "sales_and_distribution": "Performed by E05",
    "pricing_strategy": "E01 (US) - E05 has 8% discount authority only",
    "marketing_strategy": "E01 (US); E05 executes locally (trade shows, events)",
    "r_and_d": "None - E01 owns all designs and patents",
    "customer_service": "Performed by E05",
    "warehousing": "Performed by E05 (~45 days stock)"
  },
  "assets": ["Leased office and warehouse", "IT equipment", "Customer relationships (managed, not legally owned intangibles)"],
  "risks": {
    "inventory_risk": "Limited - E01 buys back obsolete stock at cost (2017 agreement)",
    "credit_risk": "Borne by E05, historically <0.5% of sales",
    "fx_risk": "Effectively borne by E01 via quarterly margin true-up",
    "market_risk": "Limited - target OM 2-4% guaranteed by true-up"
  },
  "flags_for_human_review": [
    "Royalty (3% of net sales) introduced FY2025 with no signed agreement and no change in functions or brand usage - consistent with R02, R04, R11 triggers",
    "True-up mechanism did not account for royalty, driving FY2025 loss in a limited-risk entity",
    "Two local marketing hires: check whether local marketing activities create any local marketing intangible (likely minor, execution only)"
  ]
}
```
