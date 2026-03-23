// src/components/Instructor/WithdrawalTab.tsx
// Embedded inside InstructorDashBoard as the "Withdrawal" tab

import { useEffect, useState } from "react";
import {
  FiDollarSign, FiCreditCard, FiClock, FiCheck,
  FiX, FiAlertCircle, FiEdit2, FiSend,
  FiChevronDown, FiChevronUp, FiInfo,
} from "react-icons/fi";
import { RiBankLine } from "react-icons/ri";
import axiosInstance from "../../lib/axios";
import { formatVnd } from "../../utils/currency";
import {  useToast } from "../../context/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Balance {
  grossRevenue:   number;
  platformFee:    number;
  netRevenue:     number;
  totalWithdrawn: number;
  pendingAmount:  number;
  available:      number;
  feeRate:        number;
}

interface BankAccount {
  id:            string;
  bankName:      string;
  bankBranch:    string | null;
  accountNumber: string;
  accountHolder: string;
}

interface WithdrawalRequest {
  id:           string;
  amount:       number;
  platformFee:  number;
  netAmount:    number;
  status:       "pending" | "approved" | "rejected" | "cancelled";
  note:         string | null;
  bankSnapshot: {
    bankName:      string;
    accountNumber: string;
    accountHolder: string;
  };
  createdAt: string;
  updatedAt: string;
}

const BANKS = [
  "Vietcombank", "VietinBank", "BIDV", "Agribank",
  "Techcombank", "MB Bank", "ACB", "VPBank",
  "TPBank", "Sacombank", "HDBank", "SHB",
  "OCB", "MSB", "SeABank", "LienVietPostBank",
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  pending:   { label: "Pending",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  icon: <FiClock size={12} /> },
  approved:  { label: "Approved",  color: "#22c55e", bg: "rgba(34,197,94,0.1)",   icon: <FiCheck size={12} /> },
  rejected:  { label: "Rejected",  color: "#ef4444", bg: "rgba(239,68,68,0.1)",   icon: <FiX size={12} /> },
  cancelled: { label: "Cancelled", color: "#94a3b8", bg: "rgba(148,163,184,0.1)", icon: <FiX size={12} /> },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function BalanceCard({ balance, loading }: { balance: Balance | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={S.balanceCard}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: 60, borderRadius: 10, background: "#1a2540", animation: "sk-pulse 1.4s ease infinite" }} />
        ))}
        <style>{`@keyframes sk-pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
      </div>
    );
  }
  if (!balance) return null;

  const items = [
    { label: "Gross Revenue",   value: balance.grossRevenue,   color: "#e2e8f0", note: "Total sales before fees" },
    { label: "Platform Fee",    value: -balance.platformFee,   color: "#f43f5e", note: `${(balance.feeRate*100).toFixed(0)}% platform cut` },
    { label: "Already Paid Out", value: -balance.totalWithdrawn, color: "#94a3b8", note: "Approved withdrawals" },
    { label: "Pending",         value: -balance.pendingAmount, color: "#f59e0b", note: "Awaiting approval" },
  ];

  return (
    <div style={S.balanceCard}>
      {items.map(item => (
        <div key={item.label} style={S.balanceItem}>
          <span style={S.balanceItemLabel}>{item.label}</span>
          <span style={{ ...S.balanceItemNote }}>{item.note}</span>
          <span style={{ ...S.balanceItemValue, color: item.color }}>
            {item.value < 0 ? "-" : "+"}{formatVnd(Math.abs(item.value))} ₫
          </span>
        </div>
      ))}
      <div style={S.balanceDivider} />
      <div style={S.balanceAvail}>
        <div>
          <span style={S.balanceAvailLabel}>Available to Withdraw</span>
          <span style={S.balanceAvailSub}>Net of platform fees and previous withdrawals</span>
        </div>
        <span style={S.balanceAvailValue}>{formatVnd(balance.available)} ₫</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WithdrawalTab({ instructorId }: { instructorId: string }) {
  const toast    = useToast();
  const [balance,  setBalance]  = useState<Balance | null>(null);
  const [bank,     setBank]     = useState<BankAccount | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loadingBal,  setLoadingBal]  = useState(true);
  const [loadingReqs, setLoadingReqs] = useState(true);

  // Bank form
  const [editingBank, setEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bank_name: "", bank_branch: "", account_number: "", account_holder: "",
  });
  const [savingBank, setSavingBank] = useState(false);

  // Withdrawal form
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // UI
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAll();
  }, [instructorId]);

  async function fetchAll() {
    setLoadingBal(true);
    setLoadingReqs(true);
    try {
      const [balRes, bankRes, reqRes] = await Promise.all([
        axiosInstance.get(`/withdrawal/balance/${instructorId}`),
        axiosInstance.get(`/withdrawal/bank/${instructorId}`),
        axiosInstance.get(`/withdrawal/requests/${instructorId}`),
      ]);
      setBalance(balRes.data);
      setBank(bankRes.data);
      setRequests(reqRes.data.requests ?? []);
      if (bankRes.data) {
        setBankForm({
          bank_name:      bankRes.data.bankName,
          bank_branch:    bankRes.data.bankBranch ?? "",
          account_number: bankRes.data.accountNumber,
          account_holder: bankRes.data.accountHolder,
        });
      }
    } catch {
      toast.error("error", "Failed to load withdrawal data");
    } finally {
      setLoadingBal(false);
      setLoadingReqs(false);
    }
  }


  // ── Save bank account ──────────────────────────────────────────────────────

  async function handleSaveBank() {
    if (!bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder) {
      toast.error("error", "Please fill in all required fields");
      return;
    }
    setSavingBank(true);
    try {
      await axiosInstance.post("/withdrawal/bank", {
        bank_name:      bankForm.bank_name,
        bank_branch:    bankForm.bank_branch || null,
        account_number: bankForm.account_number,
        account_holder: bankForm.account_holder,
      });
      toast.success("success", "Bank account saved successfully");
      setEditingBank(false);
      await fetchAll();
    } catch (e: unknown) {
      toast.error("error", (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save");
    } finally {
      setSavingBank(false);
    }
  }

  // ── Submit withdrawal ──────────────────────────────────────────────────────

  async function handleWithdraw() {
    const amt = parseFloat(withdrawAmount.replace(/[^0-9.]/g, ""));
    if (!amt || isNaN(amt)) {
      toast.error("error", "Please enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      await axiosInstance.post("/withdrawal/request", {
        instructor_id: instructorId,
        amount: amt,
      });
      toast.success("success", `Withdrawal request of ${formatVnd(amt)} ₫ submitted!`);
      setShowWithdrawForm(false);
      setWithdrawAmount("");
      await fetchAll();
    } catch (e: unknown) {
      toast.error("error", (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Cancel request ─────────────────────────────────────────────────────────

  async function handleCancel(id: string) {
    if (!confirm("Cancel this withdrawal request?")) return;
    try {
      await axiosInstance.delete(`/withdrawal/request/${id}`);
      toast.success("success", "Request cancelled");
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "cancelled" } : r));
    } catch {
      toast.error("error", "Could not cancel request");
    }
  }

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const netOnAmount  = parseFloat(withdrawAmount.replace(/[^0-9.]/g, "") || "0");
  const feePreview   = Math.round(netOnAmount * (balance?.feeRate ?? 0.3));
  const netPreview   = netOnAmount - feePreview;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      <div style={S.grid}>

        {/* ── LEFT COLUMN ── */}
        <div style={S.leftCol}>

          {/* Balance breakdown */}
          <div style={S.section}>
            <div style={S.sectionHead}>
              <h3 style={S.sectionTitle}><FiDollarSign size={15} /> Earnings Balance</h3>
            </div>
            <BalanceCard balance={balance} loading={loadingBal} />
          </div>

          {/* Withdraw button */}
          {balance && balance.available >= 100_000 && !showWithdrawForm && (
            <button style={S.withdrawBtn} onClick={() => setShowWithdrawForm(true)}>
              <FiSend size={15} /> Request Withdrawal
            </button>
          )}

          {balance && balance.available < 100_000 && (
            <div style={S.infoBox}>
              <FiInfo size={14} />
              <span>Minimum withdrawal is 100,000 ₫. Keep earning!</span>
            </div>
          )}

          {/* Withdrawal form */}
          {showWithdrawForm && (
            <div style={S.withdrawForm}>
              <div style={S.withdrawFormHead}>
                <span style={S.sectionTitle}><FiSend size={14} /> New Withdrawal</span>
                <button style={S.closeBtn} onClick={() => { setShowWithdrawForm(false); setWithdrawAmount(""); }}>
                  <FiX size={14} />
                </button>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Amount (₫) <span style={{ color: "#f43f5e" }}>*</span></label>
                <div style={S.amountInputWrap}>
                  <input
                    style={S.input}
                    type="number"
                    placeholder="e.g. 500000"
                    value={withdrawAmount}
                    min={100000}
                    max={balance?.available ?? 0}
                    onChange={e => setWithdrawAmount(e.target.value)}
                  />
                  <button
                    style={S.maxBtn}
                    type="button"
                    onClick={() => setWithdrawAmount(String(Math.floor(balance?.available ?? 0)))}
                  >MAX</button>
                </div>
                <span style={S.hint}>
                  Available: {formatVnd(balance?.available ?? 0)} ₫
                </span>
              </div>

              {netOnAmount > 0 && (
                <div style={S.feeBreakdown}>
                  <div style={S.feeRow}>
                    <span>Requested amount</span>
                    <span>{formatVnd(netOnAmount)} ₫</span>
                  </div>
                  <div style={{ ...S.feeRow, color: "#f43f5e" }}>
                    <span>Platform fee ({((balance?.feeRate ?? 0.3) * 100).toFixed(0)}%)</span>
                    <span>- {formatVnd(feePreview)} ₫</span>
                  </div>
                  <div style={S.feeDivider} />
                  <div style={{ ...S.feeRow, fontWeight: 700, color: "#22c55e", fontSize: 15 }}>
                    <span>You receive</span>
                    <span>{formatVnd(netPreview)} ₫</span>
                  </div>
                </div>
              )}

              {!bank && (
                <div style={{ ...S.infoBox, marginBottom: 12 }}>
                  <FiAlertCircle size={13} />
                  <span>Please save a bank account first before requesting withdrawal.</span>
                </div>
              )}

              <button
                style={{ ...S.withdrawBtn, opacity: (!bank || submitting) ? 0.5 : 1 }}
                onClick={handleWithdraw}
                disabled={!bank || submitting}
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={S.rightCol}>

          {/* Bank account */}
          <div style={S.section}>
            <div style={S.sectionHead}>
              <h3 style={S.sectionTitle}><RiBankLine size={15} /> Bank Account</h3>
              {bank && !editingBank && (
                <button style={S.editBtn} onClick={() => setEditingBank(true)}>
                  <FiEdit2 size={12} /> Edit
                </button>
              )}
            </div>

            {!editingBank && bank ? (
              <div style={S.bankCard}>
                <div style={S.bankCardAccent} />
                <div style={S.bankCardBody}>
                  <span style={S.bankName}>{bank.bankName}</span>
                  {bank.bankBranch && <span style={S.bankBranch}>{bank.bankBranch}</span>}
                  <span style={S.bankNumber}>{bank.accountNumber}</span>
                  <span style={S.bankHolder}>{bank.accountHolder}</span>
                </div>
              </div>
            ) : (
              <div style={S.bankForm}>
                {!bank && !editingBank && (
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 14px" }}>
                    Add your bank account to start receiving payouts.
                  </p>
                )}

                <div style={S.formGroup}>
                  <label style={S.label}>Bank <span style={{ color: "#f43f5e" }}>*</span></label>
                  <select
                    style={S.input}
                    value={bankForm.bank_name}
                    onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))}
                  >
                    <option value="">Select bank...</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div style={S.formGroup}>
                  <label style={S.label}>Branch (optional)</label>
                  <input style={S.input} placeholder="e.g. Ho Chi Minh City - District 1"
                    value={bankForm.bank_branch}
                    onChange={e => setBankForm(f => ({ ...f, bank_branch: e.target.value }))} />
                </div>

                <div style={S.formGroup}>
                  <label style={S.label}>Account Number <span style={{ color: "#f43f5e" }}>*</span></label>
                  <input style={S.input} placeholder="e.g. 0123456789"
                    value={bankForm.account_number}
                    onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))} />
                </div>

                <div style={S.formGroup}>
                  <label style={S.label}>Account Holder Name <span style={{ color: "#f43f5e" }}>*</span></label>
                  <input style={S.input} placeholder="Full name as on bank account"
                    value={bankForm.account_holder}
                    onChange={e => setBankForm(f => ({ ...f, account_holder: e.target.value }))} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.withdrawBtn, flex: 1 }} onClick={handleSaveBank} disabled={savingBank}>
                    {savingBank ? "Saving..." : <><FiCheck size={13} /> Save Bank Account</>}
                  </button>
                  {editingBank && (
                    <button style={S.cancelBtn} onClick={() => setEditingBank(false)}>Cancel</button>
                  )}
                </div>
              </div>
            )}

            {!editingBank && !bank && (
              <button style={{ ...S.withdrawBtn, marginTop: 12, background: "#1a2540", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
                onClick={() => setEditingBank(true)}>
                <FiCreditCard size={13} /> Add Bank Account
              </button>
            )}
          </div>

          {/* Info box */}
          <div style={S.infoCard}>
            <div style={S.infoCardTitle}><FiInfo size={13} /> How payouts work</div>
            <ul style={S.infoList}>
              <li>Platform takes a <strong>30% fee</strong> on all sales</li>
              <li>Minimum withdrawal amount: <strong>100,000 ₫</strong></li>
              <li>Requests are reviewed within <strong>1–3 business days</strong></li>
              <li>You can cancel a request while it's <strong>pending</strong></li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Withdrawal history ── */}
      <div style={{ ...S.section, marginTop: 24 }}>
        <div style={S.sectionHead}>
          <h3 style={S.sectionTitle}>
            <FiClock size={15} /> Withdrawal History
            {pendingCount > 0 && (
              <span style={S.pendingBadge}>{pendingCount} pending</span>
            )}
          </h3>
        </div>

        {loadingReqs ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#475569", fontSize: 14 }}>
            Loading...
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#475569" }}>
            <FiDollarSign size={32} style={{ marginBottom: 8, display: "block", marginInline: "auto", opacity: 0.3 }} />
            <p style={{ fontSize: 14, margin: 0 }}>No withdrawal requests yet.</p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div style={S.tableHead}>
              <span>Date</span>
              <span>Amount</span>
              <span>Net Amount</span>
              <span>Bank</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {requests.map(req => (
              <div key={req.id}>
                <div style={S.tableRow}>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>{req.createdAt}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                    {formatVnd(req.amount)} ₫
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
                    {formatVnd(req.netAmount)} ₫
                  </span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    {req.bankSnapshot?.bankName ?? "—"}
                    <br />
                    <span style={{ fontSize: 11 }}>{req.bankSnapshot?.accountNumber ?? ""}</span>
                  </span>
                  <StatusBadge status={req.status} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      style={S.detailBtn}
                      onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    >
                      {expandedId === req.id ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                    </button>
                    {req.status === "pending" && (
                      <button style={S.cancelSmBtn} onClick={() => handleCancel(req.id)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === req.id && (
                  <div style={S.expandedRow}>
                    <div style={S.expandGrid}>
                      <div>
                        <span style={S.expandLabel}>Request ID</span>
                        <span style={S.expandVal}>{req.id}</span>
                      </div>
                      <div>
                        <span style={S.expandLabel}>Platform Fee</span>
                        <span style={{ ...S.expandVal, color: "#f43f5e" }}>- {formatVnd(req.platformFee)} ₫</span>
                      </div>
                      <div>
                        <span style={S.expandLabel}>Account Holder</span>
                        <span style={S.expandVal}>{req.bankSnapshot?.accountHolder ?? "—"}</span>
                      </div>
                      <div>
                        <span style={S.expandLabel}>Last Updated</span>
                        <span style={S.expandVal}>{req.updatedAt}</span>
                      </div>
                    </div>
                    {req.note && (
                      <div style={S.noteBox}>
                        <strong>Admin note:</strong> {req.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: { paddingTop: 8 },
  grid: { display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" },

  leftCol:  { display: "flex", flexDirection: "column", gap: 14 },
  rightCol: { display: "flex", flexDirection: "column", gap: 14 },

  section: {
    background: "#0d1527", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, overflow: "hidden",
  },
  sectionHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  sectionTitle: {
    fontSize: 14, fontWeight: 700, color: "#e2e8f0", margin: 0,
    display: "flex", alignItems: "center", gap: 7,
  },

  // Balance card
  balanceCard: {
    padding: "16px 18px",
    display: "flex", flexDirection: "column", gap: 10,
  },
  balanceItem: {
    display: "flex", alignItems: "center",
    padding: "8px 12px", borderRadius: 8,
    background: "rgba(255,255,255,0.03)",
  },
  balanceItemLabel: { fontSize: 13, color: "#94a3b8", flex: 1 },
  balanceItemNote:  { fontSize: 11, color: "#475569", marginRight: 12 },
  balanceItemValue: { fontSize: 14, fontWeight: 700 },
  balanceDivider:   { height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" },
  balanceAvail: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 12px", borderRadius: 10,
    background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
  },
  balanceAvailLabel: { fontSize: 13, fontWeight: 700, color: "#e2e8f0", display: "block" },
  balanceAvailSub:   { fontSize: 11, color: "#6b8099", display: "block", marginTop: 2 },
  balanceAvailValue: { fontSize: 22, fontWeight: 800, color: "#22c55e" },

  // Withdraw button
  withdrawBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    padding: "12px 20px", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
    fontFamily: "inherit", width: "100%",
  },

  // Withdraw form
  withdrawForm: {
    background: "#0d1527", border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 14, padding: 18,
    display: "flex", flexDirection: "column", gap: 14,
  },
  withdrawFormHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  closeBtn: {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#94a3b8", width: 28, height: 28, borderRadius: 7,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  },
  amountInputWrap: { position: "relative", display: "flex", gap: 8 },
  maxBtn: {
    padding: "0 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)",
    background: "rgba(99,102,241,0.1)", color: "#a5b4fc",
    fontSize: 11, fontWeight: 800, cursor: "pointer", letterSpacing: "0.05em",
    fontFamily: "inherit", flexShrink: 0,
  },
  feeBreakdown: {
    background: "rgba(255,255,255,0.03)", borderRadius: 10,
    padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
  },
  feeRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8" },
  feeDivider: { height: 1, background: "rgba(255,255,255,0.08)" },

  // Bank card
  bankCard: {
    margin: 16, borderRadius: 12, overflow: "hidden",
    background: "linear-gradient(135deg, #1a2540, #0f172a)",
    border: "1px solid rgba(99,102,241,0.2)",
  },
  bankCardAccent: { height: 4, background: "linear-gradient(90deg, #6366f1, #818cf8)" },
  bankCardBody: {
    padding: "16px 18px",
    display: "flex", flexDirection: "column", gap: 4,
  },
  bankName:   { fontSize: 16, fontWeight: 800, color: "#e2e8f0" },
  bankBranch: { fontSize: 12, color: "#64748b" },
  bankNumber: { fontSize: 18, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.12em", marginTop: 6 },
  bankHolder: { fontSize: 13, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" },

  bankForm: { padding: 16, display: "flex", flexDirection: "column", gap: 12 },

  // Info card
  infoCard: {
    background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)",
    borderRadius: 12, padding: "14px 16px",
  },
  infoCardTitle: {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 13, fontWeight: 700, color: "#a5b4fc", marginBottom: 10,
  },
  infoList: {
    margin: 0, padding: "0 0 0 16px",
    display: "flex", flexDirection: "column", gap: 6,
    fontSize: 12, color: "#64748b", lineHeight: 1.6,
  },

  infoBox: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)",
    borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#fbbf24",
  },

  // Table
  tableHead: {
    display: "grid",
    gridTemplateColumns: "130px 120px 120px 1fr 100px 100px",
    gap: 8, padding: "10px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    fontSize: 11, fontWeight: 700, color: "#475569",
    textTransform: "uppercase", letterSpacing: "0.05em",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "130px 120px 120px 1fr 100px 100px",
    gap: 8, padding: "14px 18px", alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    transition: "background 0.15s",
  },

  expandedRow: {
    background: "rgba(99,102,241,0.04)",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    padding: "14px 18px",
  },
  expandGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: 12, marginBottom: 10,
  },
  expandLabel: { display: "block", fontSize: 11, color: "#475569", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" },
  expandVal:   { display: "block", fontSize: 13, color: "#94a3b8", fontWeight: 500 },
  noteBox: {
    background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
    borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fbbf24",
  },

  pendingBadge: {
    marginLeft: 8, padding: "2px 8px", borderRadius: 999,
    fontSize: 11, fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#f59e0b",
  },

  // Form
  formGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label:     { fontSize: 12, fontWeight: 600, color: "#64748b" },
  hint:      { fontSize: 11, color: "#475569" },
  input: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8, color: "#e2e8f0", padding: "9px 12px",
    fontSize: 13, fontFamily: "inherit", outline: "none",
    transition: "border-color 0.15s",
    width: "100%", boxSizing: "border-box" as const,
  },

  editBtn: {
    display: "flex", alignItems: "center", gap: 5,
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    color: "#94a3b8", padding: "5px 12px", borderRadius: 7,
    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  cancelBtn: {
    padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent", color: "#94a3b8", fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
  detailBtn: {
    width: 28, height: 28, borderRadius: 6,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  },
  cancelSmBtn: {
    padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
    border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)",
    color: "#f87171", cursor: "pointer", fontFamily: "inherit",
  },

  // Toast
  toast: {
    position: "fixed", top: 80, right: 24, zIndex: 9999,
    display: "flex", alignItems: "center", gap: 8,
    padding: "12px 18px", borderRadius: 10,
    fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    animation: "slideIn 0.3s ease",
  },
  toastSuccess: { background: "#166534", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" },
  toastError:   { background: "#7f1d1d", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" },
};