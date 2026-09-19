import { ApiError, founderRequest, hasSession, requestId, signIn, signOut } from "./lib/api.mjs";
import { formatDate, formatMember, nextRefillStatus, parseList, validateHttpsUrl } from "./lib/validation.mjs";

const state = { dashboard: null, view: "safety", busy: false };
const $ = (selector) => document.querySelector(selector);

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type) node.type = options.type;
  if (options.name) node.name = options.name;
  if (options.value !== undefined) node.value = options.value;
  if (options.placeholder) node.placeholder = options.placeholder;
  if (options.required) node.required = true;
  if (options.disabled) node.disabled = true;
  if (options.dataset) Object.assign(node.dataset, options.dataset);
  if (options.attrs) for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) node.append(child);
  }
  return node;
}

function button(label, onClick, className = "secondary") {
  const node = element("button", { text: label, type: "button", className });
  node.addEventListener("click", onClick);
  return node;
}

function labelField(label, input) {
  return element("label", {}, [document.createTextNode(label), input]);
}

function showBanner(message, kind = "info") {
  const banner = $("#status-banner");
  banner.textContent = message;
  banner.className = `status-banner ${kind}`;
  window.clearTimeout(showBanner.timer);
  showBanner.timer = window.setTimeout(() => banner.classList.add("hidden"), 6500);
}

function setBusy(value) {
  state.busy = value;
  document.querySelectorAll("button").forEach((node) => { node.disabled = value; });
  document.body.classList.toggle("busy", value);
}

function openModal(content) {
  $("#modal-content").replaceChildren(content);
  $("#modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  $("#modal-panel")?.focus?.();
}

function closeModal() {
  $("#modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
  $("#modal-content").replaceChildren();
}

function friendlyError(error) {
  if (error instanceof ApiError && error.code === "FORBIDDEN") return "This login is valid, but it is not on the active founder allowlist.";
  if (error instanceof ApiError && error.code === "UNAUTHORIZED") return "Your session ended. Please sign in again.";
  return error?.message || "Something went wrong.";
}

async function runMutation(action, payload, success) {
  if (state.busy) return;
  setBusy(true);
  try {
    await founderRequest(action, { ...payload, requestId: requestId() });
    closeModal();
    showBanner(success, "success");
    await loadDashboard();
  } catch (error) {
    showBanner(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

function memberLine(member) {
  return element("div", { className: "member-line" }, [
    element("strong", { text: formatMember(member) }),
    element("span", { text: member?.email || "No email" }),
  ]);
}

function emptyState(title, copy) {
  return element("div", { className: "empty" }, [
    element("div", { className: "empty-mark", text: "✓" }),
    element("h2", { text: title }),
    element("p", { text: copy }),
  ]);
}

function cardHeader(kicker, title, badge, badgeClass = "") {
  return element("div", { className: "card-header" }, [
    element("div", {}, [element("p", { className: "kicker", text: kicker }), element("h3", { text: title })]),
    element("span", { className: `badge ${badgeClass}`, text: badge }),
  ]);
}

function renderMetrics() {
  const counts = state.dashboard?.counts ?? {};
  const data = [
    ["Urgent safety", counts.urgentSafety ?? 0, "Immediate review"],
    ["Routine review", counts.routineReview ?? 0, "Before publication"],
    ["Active refills", counts.activeRefills ?? 0, "In fulfillment"],
    ["Formula audit", counts.formulaAudit ?? 0, "Unverified catalog"],
  ];
  $("#metrics").replaceChildren(...data.map(([label, count, note]) => element("article", { className: "metric-card" }, [
    element("p", { text: label }), element("strong", { text: String(count) }), element("span", { text: note }),
  ])));
}

function safetyNoteModal(task) {
  const form = element("form", { className: "modal-form" });
  const textarea = element("textarea", { required: true, attrs: { rows: "6", maxlength: "4000" }, placeholder: "Record the follow-up action or member contact outcome." });
  form.append(
    element("p", { className: "eyebrow", text: "SAFETY FOLLOW-UP" }),
    element("h2", { text: formatMember(task.member), attrs: { id: "modal-title" } }),
    element("p", { className: "subtle", text: "This note is private to founder operations. Do not diagnose; record observable facts and the escalation action taken." }),
    labelField("Private note", textarea),
    element("div", { className: "form-actions" }, [button("Cancel", closeModal, "ghost"), element("button", { text: "Save note", type: "submit", className: "primary" })]),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runMutation("add_note", { userId: task.user_id, noteType: "safety_follow_up", note: textarea.value }, "Safety follow-up note saved.");
  });
  openModal(form);
}

function renderSafety() {
  const rows = state.dashboard?.safetyQueue ?? [];
  if (rows.length === 0) return emptyState("No open safety escalations", "The urgent queue is clear. Emergency guidance remains handled before any model call.");
  return element("div", { className: "card-grid" }, rows.map((task) => element("article", { className: `queue-card safety ${task.priority}` }, [
    cardHeader("SAFETY CIRCUIT BREAKER", formatMember(task.member), task.priority.toUpperCase(), task.priority),
    memberLine(task.member),
    element("p", { className: "card-copy", text: task.notes || "Safety review required. No Ask transcript is stored in this task." }),
    element("p", { className: "timestamp", text: `Opened ${formatDate(task.created_at)}` }),
    element("div", { className: "card-actions" }, [
      button("Add follow-up note", () => safetyNoteModal(task)),
      button("Mark complete", () => runMutation("resolve_task", { taskId: task.id, resolution: "completed" }, "Safety task completed."), "primary"),
      button("Dismiss", () => runMutation("resolve_task", { taskId: task.id, resolution: "dismissed" }, "Safety task dismissed."), "ghost danger"),
    ]),
  ])));
}

async function routineModal(row) {
  setBusy(true);
  try {
    const detail = await founderRequest("routine_detail", { routineId: row.id });
    const form = element("form", { className: "modal-form routine-editor" });
    const summary = element("textarea", { value: detail.routine.summary_sentence, required: true, attrs: { rows: "3", maxlength: "600" } });
    const notes = element("textarea", { attrs: { rows: "4", maxlength: "4000" }, placeholder: "Private review notes (never shown to the member)" });
    const itemEditors = detail.items.map((item) => {
      const amount = element("input", { value: item.amount, required: true });
      const area = element("input", { value: item.area, required: true });
      const days = element("input", { value: (item.days ?? []).join(", "), placeholder: "mon, tue, wed…" });
      const purpose = element("textarea", { value: item.purpose, required: true, attrs: { rows: "2" } });
      const why = element("textarea", { value: item.why_chosen, required: true, attrs: { rows: "3" } });
      const watch = element("textarea", { value: item.watch_for ?? "", attrs: { rows: "2" } });
      const container = element("fieldset", { className: "step-editor" }, [
        element("legend", { text: `${item.timing.toUpperCase()} ${item.order_index} · ${item.brand} ${item.product_name}` }),
        element("div", { className: "field-grid" }, [labelField("Amount", amount), labelField("Area", area), labelField("Days", days)]),
        labelField("Purpose", purpose), labelField("Why chosen", why), labelField("Watch for", watch),
      ]);
      return { item, amount, area, days, purpose, why, watch, container };
    });
    const safety = detail.skinProfile ?? {};
    form.append(
      element("p", { className: "eyebrow", text: "ROUTINE REVIEW" }),
      element("h2", { text: formatMember(detail.member), attrs: { id: "modal-title" } }),
      element("div", { className: "context-strip" }, [
        element("span", { text: `Pregnancy: ${safety.pregnancy_status ?? "unanswered"}` }),
        element("span", { text: `Sensitivities: ${safety.sensitivities_status ?? "unanswered"}` }),
        element("span", { text: `Prescriptions: ${(safety.active_prescriptions ?? []).join(", ") || "none reported"}` }),
      ]),
      labelField("Member-facing summary", summary),
      ...itemEditors.map((editor) => editor.container),
      labelField("Founder notes", notes),
      element("p", { className: "fine-print", text: "Publishing always creates a new immutable routine version. Safety and prescription invariants run again on the server before commit." }),
      element("div", { className: "form-actions" }, [button("Cancel", closeModal, "ghost"), element("button", { text: "Validate & publish", type: "submit", className: "primary" })]),
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      let items;
      try {
        items = itemEditors.map(({ item, amount, area, days, purpose, why, watch }) => ({
          ...item,
          amount: amount.value.trim(), area: area.value.trim(), days: parseList(days.value, 7),
          purpose: purpose.value.trim(), why_chosen: why.value.trim(), watch_for: watch.value.trim() || null,
        }));
      } catch (error) {
        showBanner(error.message, "error");
        return;
      }
      await runMutation("publish_routine", { routineId: row.id, summarySentence: summary.value, items, founderNotes: notes.value }, "Routine published as a new immutable version.");
    });
    openModal(form);
  } catch (error) {
    showBanner(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

function renderRoutines() {
  const rows = state.dashboard?.routineQueue ?? [];
  if (rows.length === 0) return emptyState("No routines awaiting review", "New proposals will appear here before member publication.");
  return element("div", { className: "card-grid" }, rows.map((routine) => element("article", { className: "queue-card" }, [
    cardHeader(`VERSION ${routine.version}`, formatMember(routine.member), "AWAITING REVIEW", "review"),
    memberLine(routine.member), element("p", { className: "card-copy", text: routine.summary_sentence }),
    element("p", { className: "timestamp", text: `Generated ${formatDate(routine.created_at)}` }),
    element("div", { className: "card-actions" }, [button("Open review", () => routineModal(routine), "primary")]),
  ])));
}

function refillModal(refill, next) {
  if (next !== "shipped") {
    const confirm = element("div", { className: "modal-form" }, [
      element("p", { className: "eyebrow", text: "FULFILLMENT TRANSITION" }),
      element("h2", { text: `${refill.status} → ${next}`, attrs: { id: "modal-title" } }),
      element("p", { text: `${refill.brand} ${refill.product_name} for ${formatMember(refill.member)}.` }),
      element("div", { className: "form-actions" }, [button("Cancel", closeModal, "ghost"), button(`Mark ${next}`, () => runMutation("transition_refill", { refillId: refill.id, nextStatus: next }, `Refill marked ${next}.`), "primary")]),
    ]);
    return openModal(confirm);
  }
  const form = element("form", { className: "modal-form" });
  const carrier = element("input", { required: true, placeholder: "USPS, UPS, FedEx…" });
  const tracking = element("input", { required: true, placeholder: "Tracking number" });
  const url = element("input", { type: "url", placeholder: "https://…" });
  const eta = element("input", { type: "datetime-local" });
  form.append(
    element("p", { className: "eyebrow", text: "SHIPMENT DETAILS" }), element("h2", { text: `${refill.brand} ${refill.product_name}`, attrs: { id: "modal-title" } }),
    labelField("Carrier", carrier), labelField("Tracking number", tracking), labelField("Tracking URL", url), labelField("Estimated delivery", eta),
    element("div", { className: "form-actions" }, [button("Cancel", closeModal, "ghost"), element("button", { text: "Mark shipped", type: "submit", className: "primary" })]),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await runMutation("transition_refill", {
        refillId: refill.id, nextStatus: "shipped", carrier: carrier.value, trackingNumber: tracking.value,
        trackingUrl: validateHttpsUrl(url.value), estimatedDelivery: eta.value ? new Date(eta.value).toISOString() : null,
      }, "Shipment details saved.");
    } catch (error) { showBanner(error.message, "error"); }
  });
  openModal(form);
}

function renderRefills() {
  const rows = state.dashboard?.refillQueue ?? [];
  if (rows.length === 0) return emptyState("No active refills", "Requested, ordered, and shipped replenishments will appear here.");
  return element("div", { className: "card-grid" }, rows.map((refill) => {
    const next = nextRefillStatus(refill.status);
    return element("article", { className: "queue-card" }, [
      cardHeader("MANAGED REFILL", `${refill.brand} ${refill.product_name}`, refill.status.toUpperCase(), refill.status),
      memberLine(refill.member),
      refill.request_note ? element("p", { className: "card-copy", text: refill.request_note }) : null,
      refill.tracking_number ? element("p", { className: "tracking", text: `${refill.carrier || "Carrier"} · ${refill.tracking_number}` }) : null,
      element("p", { className: "timestamp", text: `Requested ${formatDate(refill.requested_at)}` }),
      next ? element("div", { className: "card-actions" }, [button(`Move to ${next}`, () => refillModal(refill, next), "primary")]) : null,
    ]);
  }));
}

function formulaModal(product) {
  const form = element("form", { className: "modal-form" });
  const ingredients = element("textarea", { required: true, attrs: { rows: "10" }, placeholder: "One ingredient per line, in label order" });
  const actives = element("textarea", { attrs: { rows: "4" }, placeholder: "Key actives, one per line" });
  const source = element("input", { required: true, placeholder: "Manufacturer URL or label evidence reference" });
  const notes = element("textarea", { attrs: { rows: "4", maxlength: "2000" }, placeholder: "Optional verification notes" });
  form.append(
    element("p", { className: "eyebrow", text: "FORMULA AUDIT" }), element("h2", { text: `${product.brand} ${product.name}`, attrs: { id: "modal-title" } }),
    element("p", { className: "subtle", text: "Only verify against authoritative label or manufacturer evidence. Model output is never sufficient evidence." }),
    labelField("Full ingredient list", ingredients), labelField("Key actives", actives), labelField("Source reference", source), labelField("Review notes", notes),
    element("div", { className: "form-actions" }, [button("Cancel", closeModal, "ghost"), button("Reject", () => submitFormula("rejected"), "ghost danger"), element("button", { text: "Verify formula", type: "submit", className: "primary" })]),
  );
  async function submitFormula(decision) {
    try {
      await runMutation("review_formula", {
        productId: product.id, decision, ingredients: parseList(ingredients.value), keyActives: parseList(actives.value, 30),
        sourceReference: source.value, reviewNotes: notes.value,
      }, decision === "verified" ? "Formula verified and promoted to trusted catalog data." : "Formula submission rejected and logged.");
    } catch (error) { showBanner(error.message, "error"); }
  }
  form.addEventListener("submit", async (event) => { event.preventDefault(); await submitFormula("verified"); });
  openModal(form);
}

function renderFormulas() {
  const rows = state.dashboard?.formulaQueue ?? [];
  if (rows.length === 0) return emptyState("No formulas awaiting audit", "Every currently recommended catalog formula has verified provenance.");
  return element("div", { className: "card-grid" }, rows.map((product) => element("article", { className: "queue-card" }, [
    cardHeader(product.category.toUpperCase(), `${product.brand} ${product.name}`, "UNVERIFIED", "review"),
    element("p", { className: "card-copy", text: "Formula fields remain untrusted and cannot satisfy sensitivity checks until a founder verifies authoritative evidence." }),
    element("p", { className: "timestamp", text: `Added ${formatDate(product.created_at)}` }),
    element("div", { className: "card-actions" }, [button("Audit formula", () => formulaModal(product), "primary")]),
  ])));
}

function renderQueue() {
  const renderers = { safety: renderSafety, routines: renderRoutines, refills: renderRefills, formulas: renderFormulas };
  $("#queue").replaceChildren(renderers[state.view]());
  document.querySelectorAll("[data-view]").forEach((node) => node.classList.toggle("active", node.dataset.view === state.view));
}

async function loadDashboard() {
  setBusy(true);
  try {
    const data = await founderRequest("dashboard");
    state.dashboard = data;
    $("#founder-role").textContent = data.founder.role;
    renderMetrics();
    renderQueue();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      signOut();
      showLogin(friendlyError(error));
    } else showBanner(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

function showLogin(error = "") {
  $("#console-view").classList.add("hidden");
  $("#login-view").classList.remove("hidden");
  $("#login-error").textContent = error;
}

function showConsole() {
  $("#login-view").classList.add("hidden");
  $("#console-view").classList.remove("hidden");
  loadDashboard();
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#login-error").textContent = "";
  setBusy(true);
  try {
    await signIn($("#email").value, $("#password").value);
    $("#password").value = "";
    showConsole();
  } catch (error) {
    $("#login-error").textContent = friendlyError(error);
  } finally { setBusy(false); }
});

$("#logout").addEventListener("click", () => { signOut(); state.dashboard = null; showLogin(); });
$("#refresh").addEventListener("click", loadDashboard);
document.querySelectorAll("[data-view]").forEach((node) => node.addEventListener("click", () => { state.view = node.dataset.view; renderQueue(); }));
document.querySelectorAll("[data-close-modal]").forEach((node) => node.addEventListener("click", closeModal));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

if (hasSession()) showConsole(); else showLogin();
