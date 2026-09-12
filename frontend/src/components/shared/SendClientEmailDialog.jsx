import { useState } from "react";
import { Mail, Send, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sendClientPortalEmail } from "@/lib/resend";
import { getAppBaseUrl } from "@/lib/helpers";
import sound from "@/lib/sound";

export default function SendClientEmailDialog({ brand, campaign, trigger }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const baseUrl = getAppBaseUrl();
  const defaultEmail = brand?.contact_email || brand?.email || "";
  const brandName = brand?.name || campaign?.brand || "Brand Partner";
  const slug = encodeURIComponent(brandName.toLowerCase().replace(/\s+/g, "-"));
  const portalUrl = campaign
    ? `${baseUrl}/view/${campaign.id}`
    : `${baseUrl}/portal/${slug}`;

  const [toEmail, setToEmail] = useState(defaultEmail);
  const [customNote, setCustomNote] = useState("");

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!toEmail.trim()) {
      toast.error("Please enter a recipient email address.");
      return;
    }

    setSending(true);
    try {
      await sendClientPortalEmail({
        to: toEmail.trim(),
        brandName,
        assetCode: campaign?.asset_code,
        locationName: campaign?.asset?.location_name || campaign?.location_name,
        status: campaign?.stage || "live",
        startDate: campaign?.start_date,
        endDate: campaign?.end_date,
        portalUrl,
        customMessage: customNote.trim(),
      });

      sound.success();
      toast.success(`Verification email sent to ${toEmail.trim()}!`, {
        description: "The brand can now access their live Proof-of-Performance portal.",
      });
      setOpen(false);
    } catch (err) {
      sound.warning();
      toast.error(err.message || "Failed to send email via Resend.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="xs"
            className="gap-1.5 text-primary border-primary/40 hover:bg-primary/10 cursor-pointer"
            data-testid="send-client-email-button"
          >
            <Mail className="size-3.5" />
            Email PoP Link
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-lg">
            <Mail className="size-4 text-primary" />
            Send PoP Portal to {brandName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Send a branded email notification via Resend with live campaign status and direct unauthenticated access to their Proof-of-Performance portal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="client-email" className="text-xs font-semibold">
              Recipient Work Email
            </Label>
            <Input
              id="client-email"
              type="email"
              required
              placeholder="e.g. marketing@brand.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="text-xs"
              data-testid="client-email-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-note" className="text-xs font-semibold">
              Personalized Note (Optional)
            </Label>
            <Textarea
              id="custom-note"
              rows={3}
              placeholder="e.g. Please find the verified installation proof and geotag photos for your campaign flight."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Portal Link Preview:</span>
              <span className="font-mono text-[10px] text-primary truncate max-w-[200px]">
                {portalUrl}
              </span>
            </div>
            <p className="text-muted-foreground">
              Client can open this link on any mobile or desktop device without signing in.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5"
              disabled={sending}
              data-testid="confirm-send-email-btn"
            >
              {sending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Sending via Resend…
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Send Notification Email
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
