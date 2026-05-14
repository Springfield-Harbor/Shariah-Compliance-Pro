# Shariah-Compliance-Pro MCP 

**The Quantum-Guard for Tokenized RWA Governance & Financial Engineering**

This repository contains the finalized MCP (Model Context Protocol) implementation for an institutional-grade gateway. The gateway provides 15 active tools for quantitative analysis, Shariah compliance, and multi-jurisdictional regulatory screening.

---

## 🛠 Active Feature Matrix & Use Cases

| Feature | Primary Function | Quantitative Use Case | Compliance Use Case | Institutional Use Case |
| --- | --- | --- | --- | --- |
| **calculate_zakat** | Institutional Net Liquidity | Portfolio-wide Zakat base discovery. | Automated year-end Shariah reporting. | High-capital liquidity auditing. |
| **evaluate_compliance** | AAOIFI Threshold Screening | Screening $33\%$ debt-to-equity ratios. | Real-time equity universe filtering. | Portfolio eligibility attestation. |
| **screen_regulations** | Jurisdictional Routing | Comparing GCC vs. Singapore roadmaps. | Cayman Islands VASP readiness check. | Multi-jurisdictional VASP licensing. |
| **model_var** | Parametric Value at Risk | 99% CI portfolio stress simulation. | Risk-budgeting compliance. | Investor pitch deck risk metrics. |
| **calculate_sharpe** | Performance Assessment | Comparing RWA vs. DeFi yield. | Risk-adjusted return reporting. | Institutional fund performance logs. |
| **simulate_sor** | Smart Order Routing | Optimizing execution across venues. | Best execution audit trails. | Treasury management efficiency. |
| **optimize_haircut** | Collateral LTV Guard | Determining haircuts for RWA loans. | Counterparty risk mitigation. | Institutional lending desk logic. |
| **audit_kyt_logic** | Know Your Transaction | Cross-border flow risk tiering. | Anti-Money Laundering (AML) audit. | High-frequency flow monitoring. |
| **monitor_concentration** | Diversification Guard | Detecting single-asset concentration. | Regulatory exposure reporting. | Risk management dashboard alerts. |
| **calculate_wal** | Amortization Schedule | Weighted Life for Project Velocity. | Debt servicing compliance. | Fixed-income product design. |
| **generate_coupon** | Distribution Engine | Tokenized yield scheduling. | Smart contract payment logic. | Investor payout reporting. |
| **calculate_tax_lot** | Disposition Accounting | HIFO/FIFO gain-loss modeling. | Tax-loss harvesting optimization. | Institutional tax reporting. |
| **stress_test** | Historical Simulation | "Liquidity Crunch" scenario modeling. | Capital adequacy (Basel III) check. | Stressed NAV reporting. |
| **model_nav** | Dynamic RWA Valuation | Battery asset depreciation modeling. | Fair-value accounting for auditors. | Real-time token price discovery. |
| **apply_guardrails** | Agentic Logic Boundaries | Capping agentic transaction values. | Safe-logic governance enforcing. | Autonomous swarm compliance. |

---

## 🚀 Access Methods

### 1. cURL (Direct SSE Handshake)

Force DNS resolution to the gateway IP for real-time heartbeat monitoring.

```bash
curl -v -N https://jamlyles.com/sse --resolve jamlyles.com:443:18.222.147.145

```

### 2. Python (Institutional Client)

Async implementation using `httpx` to maintain non-blocking SSE streams for heavy quantitative tasks.

```python
import httpx
import asyncio

async def call_quant_tool():
    async with httpx.AsyncClient(timeout=120.0) as client:
        # Step 1: Initialize SSE Session
        response = await client.get("https://jamlyles.com/sse")
        # Step 2: POST JSON-RPC Request
        payload = {
            "method": "tools/call",
            "params": {"name": "model_var", "arguments": {"principal": 10000000, "volatility": 0.15}}
        }
        res = await client.post("https://jamlyles.com/messages", json=payload)
        print(f"Status: {res.status_code}")

```

### 3. Claude Desktop (Config Integration)

Add this snippet to your `claude_desktop_config.json` to empower Claude with your 42,338-shard governance index.

```json
{
  "mcpServers": {
    "shariah-pro": {
      "command": "python",
      "args": ["/path/to/shariah-mcp/server.py"],
      "env": { "OLLAMA_HOST": "http://127.0.0.1:11434" }
    }
  }
}

```

### 4. Postman / REST API

Configure a POST request to `[https://jamlyles.com/messages](https://jamlyles.com/messages)` with:

* **Header**: `Content-Type: application/json`
* **Body**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "calculate_zakat",
    "arguments": { "liquid_assets": 1000000, "receivables": 500000, "short_term_liabilities": 200000 }
  }
}

```



### 5. Node.js (High-Frequency Listener)

Using `EventSource` to monitor agentic guardrail triggers in real-time.

```javascript
const EventSource = require('eventsource');
const es = new EventSource('https://jamlyles.com/sse');

es.on('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.method === "notifications/tool_list_changed") {
        console.log("Institutional toolset updated.");
    }
});

```

---

## 📈 Quantitative Core Formulas

The gateway utilizes the following validated models for its internal processing:

* **Institutional Zakat**: 
$$Z = (A_{liquid} + A_{receivable} - L_{short\_term}) \times 0.025$$


* **Dynamic NAV**: 
$$NAV = (Cost - \text{Depreciation}) + \text{NetCashFlow}$$


* **Weighted Average Life (WAL)**: 
$$WAL = \frac{\sum (P_t \times t)}{P_{total}}$$


* **Value at Risk (VaR)**: 
$$VaR = P \times \sigma \times Z_{\alpha}$$

