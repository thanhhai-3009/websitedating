import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Smartphone, Lock, Check, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/layout/Navbar";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/clerk-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const planDetails = {
  gold: {
    name: "Gold",
    price: 14.99,
    icon: Crown,
    gradient: "from-amber-400 to-orange-500",
    features: ["Unlimited likes", "See who likes you", "5 Super Likes/day", "1 Boost/month"],
  },
  platinum: {
    name: "Platinum",
    price: 29.99,
    icon: Sparkles,
    gradient: "from-violet-500 to-purple-600",
    features: ["Everything in Gold", "Unlimited Super Likes", "Message before matching", "Weekly Boosts"],
  },
};

const normalizePlanId = (value: string | null): keyof typeof planDetails => {
  const plan = (value || "").trim().toLowerCase();
  if (plan === "platinum") {
    return "platinum";
  }
  return "gold";
};

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const planId = normalizePlanId(searchParams.get("plan"));
  const plan = planDetails[planId] || planDetails.gold;
  const momoStatus = searchParams.get("momoStatus");
  const momoMessage = searchParams.get("momoMessage");
  const orderId = searchParams.get("orderId");

  const paymentResult = useMemo(() => {
    if (!momoStatus) return null;
    return {
      success: momoStatus === "success",
      message: momoMessage || (momoStatus === "success" ? "Payment completed successfully." : "Payment was not completed."),
    };
  }, [momoMessage, momoStatus]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMomoCheckout = async () => {
    setIsProcessing(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const response = await fetch(`${API_BASE_URL}/api/payments/momo/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string; payUrl?: string };
      if (!response.ok || !payload.payUrl) {
        throw new Error(payload.message || "Unable to initialize MoMo payment.");
      }

      window.location.assign(payload.payUrl);
    } catch (error) {
      toast({
        title: "Payment initialization failed",
        description: error instanceof Error ? error.message : "Unable to initialize MoMo payment.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar isAuthenticated />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate("/premium")}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plans
          </Button>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-lg`}>
                      <plan.icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{plan.name} Plan</h3>
                      <p className="text-muted-foreground">Monthly subscription</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${plan.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>$0.00</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span className="text-primary">${plan.price.toFixed(2)}/mo</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Badge */}
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span>Secured with 256-bit SSL encryption</span>
              </div>
            </motion.div>

            {/* Payment Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    MoMo Payment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {paymentResult && (
                      <div
                        className={`rounded-lg border px-4 py-3 text-sm ${
                          paymentResult.success
                            ? "border-green-500/40 bg-green-500/10 text-green-700"
                            : "border-destructive/40 bg-destructive/10 text-destructive"
                        }`}
                      >
                        <p className="font-medium">
                          {paymentResult.success ? "Payment successful" : "Payment failed"}
                        </p>
                        <p>{paymentResult.message}</p>
                        {orderId && <p className="mt-1 text-xs">Order: {orderId}</p>}
                      </div>
                    )}

                    <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                      You will be redirected to MoMo to complete your payment securely.
                    </div>

                    <Button
                      variant="gradient"
                      size="lg"
                      className="w-full"
                      disabled={isProcessing}
                      onClick={handleMomoCheckout}
                    >
                      {isProcessing ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Redirecting to MoMo...
                        </div>
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4 mr-2" />
                          Pay with MoMo
                        </>
                      )}
                    </Button>

                    {paymentResult?.success && (
                      <Button variant="outline" className="w-full" onClick={() => navigate("/discover")}>Continue to Discover</Button>
                    )}

                    <p className="text-xs text-center text-muted-foreground">
                      By confirming, you agree to our Terms of Service and authorize this recurring charge.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Payment;
