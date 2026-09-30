import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileCheck2,
  Receipt,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtMoney, fmtDate, errMessage } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import sound from "@/lib/sound";

export default function PaymentMilestones({ campaign, me }) {
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState("advance");
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_ref: "",
    received_at: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const invoice = campaign?.invoice;
  const milestones = invoice?.milestones;

  if (!invoice) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-secondary/10 p-4 text-center">
        <Receipt className="mx-auto size-6 text-muted-foreground/60 mb-1.5" />
        <p className="text-xs font-medium text-foreground">Awaiting GST Invoice</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          2-Stage milestone tracking and revenue sharing activate once Finance records the invoice.
        </p>
      </div>
    );
  }

  const advance = milestones?.advance ?? {
    percent: 50,
    amount: Math.round((invoice.total_amount || invoice.amount || 0) * 0.5),
    status: "pending",
  };

  const balance = milestones?.balance ?? {
    percent: 50,
    amount: (invoice.total_amount || invoice.amount || 0) - (advance.amount || 0),
    term_type: "net_5_days",
    due_date: invoice.start_date,
    status: "pending",
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const isBalanceOverdue =
    balance.status !== "received" &&
    balance.due_date &&
    new Date(balance.due_date) < new Date(todayStr);

  const daysRemaining = balance.due_date
    ? Math.ceil((new Date(balance.due_date) - new Date(todayStr)) / (1000 * 60 * 60 * 24))
    : null;

  const totalPaid =
    (advance.status === "received" ? Number(advance.amount) : 0) +
    (balance.status === "received" ? Number(balance.amount) : 0);

  const totalBilled = Number(invoice.total_amount || invoice.amount || 0);
  const outstanding = Math.max(0, totalBilled - totalPaid);
  const isFullySettled = totalPaid >= totalBilled && totalBilled > 0;

  const canRecordPayment = me?.role === "admin" || me?.role === "finance" || me?.role === "finance_manager" || me?.role === "ops";

  const recordMutation = useMutation({
    mutationFn: async (payload) => {
      const updatedMilestones = {
        advance: { ...advance },
        balance: { ...balance },
      };

      if (payload.target === "advance") {
        updatedMilestones.advance = {
          ...updatedMilestones.advance,
          status: "received",
          received_at: payload.received_at,
          payment_ref: payload.payment_ref,
          amount: Number(payload.amount) || updatedMilestones.advance.amount,
          notes: payload.notes,
        };
      } else {
        updatedMilestones.balance = {
          ...updatedMilestones.balance,
          status: "received",
          received_at: payload.received_at,
          payment_ref: payload.payment_ref,
          amount: Number(payload.amount) || updatedMilestones.balance.amount,
          notes: payload.notes,
        };
      }

      const updatedInvoice = {
        ...invoice,
        milestones: updatedMilestones,
        last_payment_recorded_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("campaigns")
        .update({ invoice: updatedInvoice })
        .eq("id", campaign.id);

      if (error) throw { body: { detail: error.message } };
      return updatedInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      sound.success();
      toast.success("Payment milestone recorded successfully!");
      setRecordOpen(false);
      setPaymentForm({
        amount: "",
        payment_ref: "",
        received_at: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err) => {
      sound.warning();
      toast.error(errMessage(err, "Could not record payment"));
    },
  });

  const termLabels = {
    on_onboarding: "Day of Onboarding (0 Days)",
    net_5_days: "Net 5 Days (Post-GTP)",
    net_15_days: "Net 15 Days",
    net_30_days: "Net 30 Days",
    custom_po: "Custom PO Terms",
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-heading text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Banknote className="size-4 text-primary" />
              2-Stage Payment Milestone Tracker
            </h4>
            {isFullySettled ? (
              <Badge variant="default" className="bg-emerald-600 text-white text-[10px] gap-1 py-0">
                <CheckCircle2 className="size-3" /> Fully Settled
              </Badge>
            ) : isBalanceOverdue ? (
              <Badge variant="destructive" className="text-[10px] gap-1 py-0 animate-pulse">
                <AlertCircle className="size-3" /> Balance Overdue
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 py-0">
                In Progress
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Advance on booking &amp; flexible balance collection schedule.
          </p>
        </div>

        {canRecordPayment && !isFullySettled && (
          <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="h-7 text-xs gap-1.5 cursor-pointer" data-testid="record-payment-btn">
                  <CreditCard className="size-3.5" />
                  Record Payment
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">
                  Record Campaign Payment · {campaign.brand}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Select Milestone Installment</Label>
                  <Select
                    value={selectedMilestone}
                    onValueChange={(v) => {
                      setSelectedMilestone(v);
                      const defAmt = v === "advance" ? advance.amount : balance.amount;
                      setPaymentForm((f) => ({ ...f, amount: String(defAmt) }));
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="advance">
                        Milestone 1: Advance Payment ({advance.percent}% — {fmtMoney(advance.amount)})
                      </SelectItem>
                      <SelectItem value="balance">
                        Milestone 2: Balance Payment ({balance.percent}% — {fmtMoney(balance.amount)})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Amount Received (₹)</Label>
                    <Input
                      type="number"
                      value={paymentForm.amount || (selectedMilestone === "advance" ? advance.amount : balance.amount)}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentForm.received_at}
                      onChange={(e) => setPaymentForm({ ...paymentForm, received_at: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Bank / UTR Reference No.</Label>
                  <Input
                    placeholder="e.g. NEFT-9821038 / Cheque #0021"
                    value={paymentForm.payment_ref}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_ref: e.target.value })}
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input
                    placeholder="e.g. Received via HDFC corporate account"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  size="sm"
                  onClick={() =>
                    recordMutation.mutate({
                      target: selectedMilestone,
                      amount: paymentForm.amount || (selectedMilestone === "advance" ? advance.amount : balance.amount),
                      payment_ref: paymentForm.payment_ref,
                      received_at: paymentForm.received_at,
                      notes: paymentForm.notes,
                    })
                  }
                  disabled={recordMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  Confirm &amp; Update Milestone
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Progress Bar & Financial Summary */}
      <div className="grid grid-cols-3 gap-2 text-center bg-secondary/30 rounded-lg p-2.5">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Total Contract</p>
          <p className="font-heading text-xs font-bold text-foreground mt-0.5">{fmtMoney(totalBilled)}</p>
        </div>
        <div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-mono tracking-wider">Collected</p>
          <p className="font-heading text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{fmtMoney(totalPaid)}</p>
        </div>
        <div>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-mono tracking-wider">Outstanding</p>
          <p className="font-heading text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">{fmtMoney(outstanding)}</p>
        </div>
      </div>

      {/* Milestones Visual Cards */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {/* Milestone 1: Advance */}
        <div
          className={cn(
            "rounded-lg border p-3 transition-all",
            advance.status === "received"
              ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
              : "border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>1. Advance ({advance.percent}%)</span>
            </span>
            {advance.status === "received" ? (
              <Badge className="bg-emerald-600 text-white text-[10px] py-0">Received</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] py-0">
                Pending
              </Badge>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-heading text-base font-bold text-foreground">
              {fmtMoney(advance.amount)}
            </span>
            {advance.received_at && (
              <span className="text-[10px] text-muted-foreground">
                Paid: {fmtDate(advance.received_at)}
              </span>
            )}
          </div>
          {advance.payment_ref && (
            <p className="text-[10px] font-mono text-muted-foreground truncate mt-1">
              Ref: {advance.payment_ref}
            </p>
          )}
        </div>

        {/* Milestone 2: Balance */}
        <div
          className={cn(
            "rounded-lg border p-3 transition-all",
            balance.status === "received"
              ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
              : isBalanceOverdue
              ? "border-destructive/60 bg-destructive/10"
              : "border-sky-500/40 bg-sky-50/30 dark:bg-sky-950/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>2. Balance ({balance.percent}%)</span>
            </span>
            {balance.status === "received" ? (
              <Badge className="bg-emerald-600 text-white text-[10px] py-0">Received</Badge>
            ) : isBalanceOverdue ? (
              <Badge variant="destructive" className="text-[10px] py-0">Overdue</Badge>
            ) : (
              <Badge variant="outline" className="text-sky-600 border-sky-300 text-[10px] py-0">
                Due in {daysRemaining !== null ? `${daysRemaining}d` : "—"}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-heading text-base font-bold text-foreground">
              {fmtMoney(balance.amount)}
            </span>
            {balance.due_date && (
              <span className={cn("text-[10px]", isBalanceOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
                Due: {fmtDate(balance.due_date)}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground truncate mt-1">
            Terms: {termLabels[balance.term_type] || balance.term_type || "Net 5 Days"}
          </p>
        </div>
      </div>

      {/* Revenue Sharing Insights for this Campaign */}
      {invoice.party_share_amount > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between text-xs">
          <div>
            <span className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
              <Sparkles className="size-3 text-primary" />
              Venue Revenue Share ({invoice.venue_name || "Mall"})
            </span>
            <p className="text-[10px] text-muted-foreground">
              Mall Payout: {fmtMoney(invoice.party_share_amount)} ({invoice.party_share_percent || 50}%)
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground">Net C&amp;W Profit</span>
            <p className="font-heading text-xs font-bold text-primary">
              {fmtMoney(invoice.net_revenue || invoice.untaxed_amount - invoice.party_share_amount)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
