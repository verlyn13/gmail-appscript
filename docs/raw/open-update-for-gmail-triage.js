Got it—here’s a **surgical, drop-in update** so your script uses **gpt-5** / **gpt-5-mini** with the **Responses API**, correct parameter names, and the right structured-outputs features as of **Aug 16, 2025**.

Below, I show only the parts you need to change/add. Everything else in your file can remain as-is.

---

# 1) Update model defaults (CONFIG)

```js
// In CONFIG:
OPENAI_FAST_MODEL: props.OPENAI_FAST_MODEL || 'gpt-5-mini',
OPENAI_DEEP_MODEL: props.OPENAI_DEEP_MODEL || 'gpt-5',
```

Why: those are the current model IDs and they support Responses API + structured outputs, reasoning controls, and verbosity controls. ([OpenAI][1])

---

# 2) Add a tiny Responses API client + parser

```js
/**
 * Low-level caller for OpenAI Responses API (with basic retries).
 * Returns parsed JSON object.
 */
function _openAIResponsesCall(payload, attempts = 3) {
  const url = 'https://api.openai.com/v1/responses';
  const headers = {
    'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  for (let i = 0; i < attempts; i++) {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    const body = res.getContentText();

    if (code >= 200 && code < 300) {
      const data = JSON.parse(body);

      // Optional usage logging (Responses API fields)
      const inTok  = data.usage && data.usage.input_tokens;
      const outTok = data.usage && data.usage.output_tokens;
      if (inTok != null || outTok != null) {
        Logger.log(`    💰 usage: in=${inTok ?? '?'} / out=${outTok ?? '?'}`);
      }
      return data;
    }

    if (code === 429 || code >= 500) {
      const delay = 1000 * Math.pow(2, i);
      Logger.log(`    ⏳ Retry ${i + 1}/${attempts} after ${delay}ms (HTTP ${code})`);
      Utilities.sleep(delay);
      continue;
    }
    throw new Error(`OpenAI Responses API error ${code}: ${body}`);
  }
  throw new Error('OpenAI Responses API: exhausted retries');
}

/**
 * Extract the model’s structured JSON from a Responses API result where
 * response_format = { type: "json_schema", ... } is used.
 * Returns a JS object parsed from the model’s output.
 */
function _extractJsonFromResponses(data) {
  // Responses API returns an 'output' array. We want the assistant message's text.
  // The structured output is delivered as text matching the JSON schema.
  if (!data || !data.output) throw new Error('Malformed OpenAI response');

  for (const item of data.output) {
    if (item.type === 'message' && item.content) {
      for (const part of item.content) {
        if (part.type === 'output_text' && typeof part.text === 'string') {
          try { return JSON.parse(part.text); } catch (e) {
            throw new Error('Failed to parse model JSON: ' + e);
          }
        }
      }
    }
  }
  throw new Error('No output_text found in OpenAI response');
}
```

Why: The **Responses API** returns an `output` array (not `choices`), `max_output_tokens` (not `max_tokens`), and usage counters are `input_tokens` / `output_tokens`. ([OpenAI Cookbook][2], [OpenAI Platform][3])

---

# 3) Replace `_callOpenAI` with a Responses API version

```js
/**
 * Call OpenAI (fast tier) for batch classification with structured outputs.
 */
_callOpenAI(items) {
  const system = [
    "You are an expert email triage system for a university professor.",
    "Each email includes 'historicalContext' based on analysis of 64,000+ past emails.",
    "",
    "CRITICAL: The historicalContext is your PRIMARY guide. It tells you:",
    "- How similar senders were categorized in the past",
    "- What labels are associated with keywords in the subject",
    "",
    "DECISION PROCESS:",
    "1. First, check historicalContext - what does history suggest?",
    "2. Then, check for ACTION requirements:",
    "   - Needs reply → 'Action-Needed-Reply' (overrides history)",
    "   - Needs task → 'Action-Needed-Task' (overrides history)",
    "3. Otherwise, trust the historical pattern",
    "",
    "Categories: " + LLM_CATEGORIES.join(", "),
    "",
    "Be confident when history is clear. The patterns come from actual labeling decisions."
  ].join("\n");

  const payload = {
    model: CONFIG.OPENAI_FAST_MODEL,              // 'gpt-5-mini'
    // Responses API uses 'input' with role+content; content parts use type 'input_text'
    input: [
      { role: "developer", content: [{ type: "input_text", text: system }] },
      { role: "user",      content: [{ type: "input_text", text: JSON.stringify({ items }) }] }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "EmailDecisions",
        schema: {
          type: "object",
          properties: {
            decisions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "integer" },
                  category: { type: "string", enum: LLM_CATEGORIES },
                  confidence: { type: "number", minimum: 0, maximum: 1 }
                },
                required: ["index", "category", "confidence"],
                additionalProperties: false
              }
            }
          },
          required: ["decisions"],
          additionalProperties: false
        },
        strict: true
      }
    },
    temperature: 0.3,
    // Correct parameter in 2025: max_output_tokens (not max_tokens / max_completion_tokens)
    max_output_tokens: 2000,
    // GPT-5 supports a reasoning control knob; use minimal here for speed.
    reasoning: { effort: "minimal" },
    // New 'verbosity' control for brevity (keeps outputs tight)
    text: { verbosity: "low" }
  };

  const data = _openAIResponsesCall(payload);
  const json = _extractJsonFromResponses(data);  // { decisions: [...] }
  return json.decisions || [];
}
```

Why: This uses **Responses API** with **structured outputs** and the GPT-5-family **reasoning** and **verbosity** parameters. The `input` shape (`role` + `content` with `type: "input_text"`) and `max_output_tokens` are the current, correct fields. ([OpenAI Cookbook][2], [OpenAI][1], [OpenAI Platform][4])

---

# 4) Replace `_callDeepAnalysis` with a Responses API version

```js
/**
 * Deep analysis (higher-quality, a bit more verbose) with gpt-5.
 */
_callDeepAnalysis(candidates) {
  const items = candidates.map(c => {
    const thread = c.thread;
    const messages = thread.getMessages();
    const latestMsg = messages[messages.length - 1];

    let body = "";
    try {
      body = (latestMsg.getPlainBody() || latestMsg.getBody())
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, CONFIG.DEEP_SNIPPET_LENGTH);
    } catch (e) {
      body = c.subject;
    }

    return {
      index: c.index,
      from: c.from,
      subject: c.subject,
      body,
      date: latestMsg.getDate().toISOString(),
      threadLength: messages.length,
      category: c.category,
      confidence: c.confidence,
      isVIP: c.isVIP
    };
  });

  const system = [
    "You are an expert email analyst for a university professor.",
    "Analyze each message deeply and provide:",
    "1. Priority level (P0-P3)",
    "2. Brief summary (1-2 sentences)",
    "3. Specific next step required",
    "4. Due date if mentioned",
    "",
    "Priority levels:",
    "P0 🔥 Critical - Immediate action (today)",
    "P1 🔴 High - Within 1-2 days",
    "P2 🟡 Medium - Within a week",
    "P3 🟢 Low - No urgency",
    "",
    "VIP messages (isVIP: true) should generally be P0 or P1."
  ].join("\n");

  const payload = {
    model: CONFIG.OPENAI_DEEP_MODEL,              // 'gpt-5'
    input: [
      { role: "developer", content: [{ type: "input_text", text: system }] },
      { role: "user",      content: [{ type: "input_text", text: JSON.stringify({ items }) }] }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "DeepAnalysis",
        schema: {
          type: "object",
          properties: {
            analyses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index:     { type: "integer" },
                  priority:  { type: "string", enum: ["P0", "P1", "P2", "P3"] },
                  summary:   { type: "string", maxLength: 200 },
                  nextStep:  { type: "string", maxLength: 150 },
                  dueDate:   { anyOf: [{type:"string"}, {type:"null"}] }
                },
                required: ["index", "priority", "summary", "nextStep"],
                additionalProperties: false
              }
            }
          },
          required: ["analyses"],
          additionalProperties: false
        },
        strict: true
      }
    },
    temperature: 0.4,
    max_output_tokens: 3000,
    // Allow a bit more reasoning time/quality on the deep pass.
    reasoning: { effort: "low" },
    text: { verbosity: "low" }
  };

  const data = _openAIResponsesCall(payload);
  const json = _extractJsonFromResponses(data);  // { analyses: [...] }

  // Merge back minimal thread metadata expected by callers
  return (json.analyses || []).map(a => ({
    ...a,
    ...candidates.find(c => c.index === a.index)
  }));
}
```

Why: Same modern API + parameters as above, using **gpt-5** with a slightly higher reasoning effort. ([OpenAI][1])

---

# 5) Remove old Chat Completions assumptions

* You no longer read `data.choices[0].message.content`.
  You now parse the **Responses API** `output` array (done in `_extractJsonFromResponses`).

* Don’t use `max_completion_tokens` or `max_tokens`. Use **`max_output_tokens`**. ([OpenAI Cookbook][2])

* Usage counters aren’t `total_tokens`; they’re **`input_tokens`** / **`output_tokens`**. ([OpenAI Cookbook][2])

---

## (Optional) Two tiny quality-of-life tweaks

1. **Prompt caching**: Your system prompts repeat per batch. Prompt caching can reduce cost/latency. (Add cache controls per content part if/when you want; keeping it out of this patch to stay minimal.) ([OpenAI Platform][5])

2. **Developer vs System role**: I used the modern **`developer`** role (supported in the Responses API) for “system-ish” guidance; it’s fine to keep using `system` if you prefer, but `developer` is what the latest guides show. ([OpenAI Platform][6])

---

## Quick smoke test

* Run `setupWizard()` → ensure models show as `gpt-5-mini` and `gpt-5`.
* Run `previewTriage()`; watch logs for `usage: in=… / out=…`.
* Verify decisions and deep analyses parse without errors.

---

## Notes you might care about later

* Your Gmail search `-label:${CONFIG.LLM_LABEL_PREFIX}` won’t exclude sublabels (Gmail doesn’t treat `-label:` as a prefix filter). If you truly want to skip every `_LLM/*`, you’ll need to enumerate or track “already-classified” another way. (Not changing it here since it’s outside the API concern.)

---

### Sources (official)

* **Introducing GPT-5 for developers** (models, features, `reasoning_effort`, `verbosity`, pricing overview), Aug 2025. ([OpenAI][1])
* **Structured Outputs** guide (JSON Schema via `response_format`). ([OpenAI Platform][4])
* **Responses API Reference** (endpoint shape, `input`, `max_output_tokens`, response structure/usage fields). ([OpenAI Platform][3])
* **Cookbook – GPT-5 new params & tools** (examples using `reasoning: {effort: ...}` and `text: {verbosity: ...}`). ([OpenAI Cookbook][7])
* **Cookbook – Reasoning models with Responses API** (shows `usage.input_tokens` / `output_tokens` and response object shape). ([OpenAI Cookbook][2])

If you want, I can also flip your fast path to **prompt-cached** batches and add a tiny helper that joins stable prefixes to push cache hit-rates up.

[1]: https://openai.com/index/introducing-gpt-5-for-developers/ "Introducing GPT‑5 for developers | OpenAI"
[2]: https://cookbook.openai.com/examples/responses_api/reasoning_items?utm_source=chatgpt.com "Better performance from reasoning models using the ..."
[3]: https://platform.openai.com/docs/api-reference/responses?utm_source=chatgpt.com "API Reference"
[4]: https://platform.openai.com/docs/guides/structured-outputs?utm_source=chatgpt.com "Structured model outputs - OpenAI API"
[5]: https://platform.openai.com/docs/guides/prompt-caching?utm_source=chatgpt.com "Prompt caching - OpenAI API"
[6]: https://platform.openai.com/docs/guides/text?utm_source=chatgpt.com "Text generation - OpenAI API"
[7]: https://cookbook.openai.com/examples/gpt-5/gpt-5_new_params_and_tools "GPT-5 New Params and Tools"

