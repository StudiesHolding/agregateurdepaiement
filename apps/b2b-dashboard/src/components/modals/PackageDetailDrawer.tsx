"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  CheckCircle2,
  Clock,
  Users,
  Star,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Award,
  Zap,
  ChevronDown,
  Info,
  FileText,
  Minus,
  Plus,
  CreditCard,
  Smartphone
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { b2bOrders } from "@/lib/api";
import { toast } from "sonner";
import { CountryCurrencySelector, COUNTRIES, type CountryConfig } from "@/components/ui/CountryCurrencySelector";

interface PackageDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: any;
}

export function PackageDetailDrawer({ isOpen, onClose, pkg }: PackageDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [expandedCurriculum, setExpandedCurriculum] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<"XAF" | "EUR" | "USD">("XAF");
  const [selectedCountry, setSelectedCountry] = useState("CM");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mobile_money">("card");
  const [licenseCount, setLicenseCount] = useState(5);
  const [step, setStep] = useState<"details" | "purchase">("details");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => setShowContent(true), 50);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
      setStep("details");
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  const checkoutMutation = useMutation({
    mutationFn: (data: { package_id: number; total_licenses: number; paymentMethod?: string; countryCode?: string; currency?: string }) =>
      b2bOrders.initiatePayment(data),
    onSuccess: (response) => {
      // Handle payment redirect based on response
      const { paymentUrl, checkoutUrl, redirectUrl } = response.data.data || {};
      const redirectTo = paymentUrl || checkoutUrl || redirectUrl;

      if (redirectTo) {
        // Redirect to payment provider (CinetPay, KKiaPay, Stripe, etc.)
        window.location.href = redirectTo;
      } else {
        // Payment completed directly (e.g., wallet balance)
        queryClient.invalidateQueries({ queryKey: ["b2b-packages"] });
        queryClient.invalidateQueries({ queryKey: ["b2b-orders"] });
        queryClient.invalidateQueries({ queryKey: ["b2b-dashboard-stats"] });
        toast.success("Package acquis avec succès !");
        onClose();
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Échec de la transaction");
    }
  });

  if (!mounted || !pkg) return null;

  const formations = pkg.packageFormations || pkg.package?.packageFormations || [];
  const isCatalog = !pkg.company_id;
  const basePrice = (pkg.price || pkg.package?.price || 0);
  const baseCurrency = (pkg.currency || pkg.package?.currency || "EUR");

  // Extended conversion rates (to EUR as base)
  const ratesToEUR: Record<string, number> = {
    XAF: 655.957,
    XOF: 655.957,
    EUR: 1,
    USD: 1.08,
    GBP: 0.856,
    CHF: 0.942,
    CAD: 1.465,
    JPY: 162.45,
    CNY: 7.85,
    KRW: 1462.5,
    INR: 90.25,
    BRL: 5.42,
    MXN: 18.45,
    ZAR: 20.85,
    NGN: 890.5,
    GHS: 12.85,
    KES: 164.5,
    MAD: 10.85,
  };

  const convertPrice = (price: number, from: string, to: string) => {
    // If same currency, no conversion needed
    if (from === to) return price;

    // Get rate to EUR (base), default to 1 if unknown
    const fromRate = ratesToEUR[from] || 1;
    const toRate = ratesToEUR[to] || 1;

    // Convert: price -> EUR -> target currency
    const priceInEur = price / fromRate;
    return priceInEur * toRate;
  };

  const unitPrice = convertPrice(basePrice, baseCurrency, displayCurrency);
  const totalPrice = unitPrice * licenseCount;

  // Get current country config
  const currentCountry = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];

  const handlePurchase = () => {
    // Use intelligent payment orchestrator - it will handle provider routing automatically
    checkoutMutation.mutate({
      package_id: pkg.id,
      total_licenses: licenseCount,
      currency: displayCurrency,
      countryCode: selectedCountry,
      paymentMethod
    });
  };

  return (
    <>
      {/* Backdrop - highest z-index to cover sidebar and header */}
      <div
        className={cn(
          "fixed inset-0 z-[9999] bg-background/90 backdrop-blur-3xl transition-all duration-700 ease-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Main Overlay - z-index higher than backdrop */}
      <div
        className={cn(
          "fixed z-[10000] left-1/2 top-1/2 -translate-x-1/2 w-[95%] max-w-4xl h-[85vh] bg-surface rounded-[40px] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex flex-col",
          isOpen && showContent ? "scale-100 opacity-100 -translate-y-1/2" : "scale-90 opacity-0 translate-y-[-40%]"
        )}
      >
        {/* Top Decorative bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-primary animate-gradient-x shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-surface/40 backdrop-blur-2xl sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-5">
            <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary shadow-inner">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-text-main tracking-tight line-clamp-1 max-w-md">
                {pkg.title || pkg.package?.title}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                  {step === "purchase" ? "Finaliser l'achat" : "Accès Premium Immédiat"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group h-10 w-10 rounded-2xl bg-white/5 text-text-muted hover:text-white hover:bg-error/20 flex items-center justify-center transition-all duration-300 hover:rotate-90 active:scale-95 border border-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 pb-40">
          {step === "details" ? (
            <>
              {/* Content Grid */}
              <div className="grid lg:grid-cols-5 gap-10 items-start">
                {/* Gallery */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="relative aspect-square rounded-[32px] overflow-hidden border border-white/10 shadow-2xl group ring-1 ring-white/5">
                    {pkg.image_url || pkg.package?.image_url ? (
                      <Image
                        src={pkg.image_url || pkg.package?.image_url}
                        alt="Package Hero"
                        width={500}
                        height={500}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-brand flex items-center justify-center">
                        <Star className="h-20 w-20 text-white/10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-60" />
                  </div>

                  {/* Badges */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center text-center gap-1.5">
                      <ShieldCheck className="h-5 w-5 text-success" />
                      <span className="text-[10px] font-black uppercase text-text-main">Accès Sécurisé</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center text-center gap-1.5">
                      <Award className="h-5 w-5 text-warning" />
                      <span className="text-[10px] font-black uppercase text-text-main">Certifié</span>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="lg:col-span-3 space-y-8">
                  {/* Description */}
                  <section className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                      <Info size={12} className="text-primary" />
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest">Description</span>
                    </div>
                    <p className="text-base text-text-light leading-relaxed font-medium">
                      {pkg.description || pkg.package?.description || "Ce programme d'élite offre une immersion exhaustive dans les compétences clés requises par le marché actuel."}
                    </p>
                  </section>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-4">
                    {[
                      { icon: Clock, label: "40h de cours", color: "text-primary", bg: "bg-primary/5" },
                      { icon: FileText, label: `${formations.length} Modules`, color: "text-secondary", bg: "bg-secondary/5" },
                      { icon: Users, label: "Public B2B", color: "text-success", bg: "bg-success/5" }
                    ].map((stat, i) => (
                      <div key={i} className={cn("flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-white/5", stat.bg)}>
                        <stat.icon size={16} className={stat.color} />
                        <span className="text-xs font-black text-text-main tracking-tight">{stat.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Features */}
                  <section className="space-y-4">
                    <h4 className="text-sm font-black text-text-main uppercase tracking-[0.15em] opacity-80">Avantages Inclus</h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {[
                        "Tracking de progression Admin",
                        "Attribution instantanée",
                        "Documentation complète",
                        "Support technique dédié"
                      ].map((benefit, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                          <span className="text-xs font-medium text-text-light">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <hr className="border-white/5" />

              {/* Curriculum */}
              <section className="space-y-6">
                <div className="flex items-center justify-between bg-white/[0.01] p-2 rounded-3xl border border-white/5">
                  <button
                    onClick={() => setExpandedCurriculum(!expandedCurriculum)}
                    className="flex items-center justify-between w-full px-6 py-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-1 w-12 bg-primary rounded-full group-hover:w-16 transition-all duration-500" />
                      <h3 className="text-lg font-black text-text-main tracking-tight uppercase">Programme détaillé</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-text-muted uppercase italic">{formations.length} chapitres</span>
                      <ChevronDown className={cn("h-6 w-6 text-primary transition-transform duration-500", expandedCurriculum && "rotate-180")} />
                    </div>
                  </button>
                </div>

                <div className={cn(
                  "grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-700",
                  expandedCurriculum ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
                )}>
                  {formations.map((pf: any, index: number) => {
                    const course = pf.globalCourse || pf.specificCourse;
                    if (!course) return null;

                    return (
                      <div
                        key={pf.id || index}
                        className="flex items-center gap-5 p-5 rounded-3xl bg-surface border border-white/[0.04] hover:border-primary/30 hover:bg-primary/[0.02] transition-all"
                      >
                        <div className="h-10 w-10 rounded-2xl bg-background flex items-center justify-center text-text-muted text-[11px] font-black">
                          {(index + 1).toString().padStart(2, '0')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-text-main truncate">{course.title}</h4>
                          <p className="text-[10px] text-text-muted font-bold uppercase">Durée estimée : 4h 30min</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            /* Purchase Step */
            <div className="max-w-xl mx-auto space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-primary/10 text-primary mb-4">
                  <CreditCard className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-black text-text-main">
                  {isCatalog ? "Finaliser votre achat" : "Ajouter des licences"}
                </h3>
                <p className="text-text-muted mt-2">
                  {isCatalog
                    ? "Sélectionnez le nombre de licences dont vous avez besoin"
                    : `${pkg.total_licenses || 0} licences actuelles • Ajoutez-en davantage`
                  }
                </p>
              </div>

              {/* Country & Currency Selection */}
              <CountryCurrencySelector
                selectedCountry={selectedCountry}
                selectedCurrency={displayCurrency}
                onCountryChange={(country: CountryConfig) => {
                  setSelectedCountry(country.code);
                  setDisplayCurrency(country.defaultCurrency as "XAF" | "EUR" | "USD");
                  if (!country.supportMobileMoney && paymentMethod === "mobile_money") {
                    setPaymentMethod("card");
                  }
                }}
                onCurrencyChange={(curr) => setDisplayCurrency(curr as "XAF" | "EUR" | "USD")}
              />

              {/* Payment Method Selection */}
              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                  Mode de paiement
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                      paymentMethod === "card"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-white/5 border-white/10 text-text-muted hover:bg-white/10"
                    )}
                  >
                    <CreditCard className="h-6 w-6" />
                    <span className="text-xs font-bold">Carte</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentCountry.supportMobileMoney) {
                        toast.error(
                          `Le Mobile Money n'est pas disponible pour ${currentCountry.nameFr}. Veuillez choisir le paiement par carte.`
                        );
                        return;
                      }
                      setPaymentMethod("mobile_money");
                    }}
                    disabled={!currentCountry.supportMobileMoney}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                      paymentMethod === "mobile_money"
                        ? "bg-primary/10 border-primary text-primary"
                        : currentCountry.supportMobileMoney
                          ? "bg-white/5 border-white/10 text-text-muted hover:bg-white/10"
                          : "bg-white/5 border-white/5 text-text-muted/50 cursor-not-allowed"
                    )}
                  >
                    <Smartphone className="h-6 w-6" />
                    <span className="text-xs font-bold">Mobile Money</span>
                  </button>
                </div>
                {paymentMethod === "card" ? (
                  <p className="text-[10px] text-text-muted mt-2 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    Paiement sécurisé par Stripe (Visa, Mastercard)
                  </p>
                ) : currentCountry.supportMobileMoney ? (
                  <p className="text-[10px] text-success mt-2 flex items-center gap-1">
                    <Smartphone className="h-3 w-3" />
                    {currentCountry.mobileMoneyProviders?.join(", ")} disponibles pour {currentCountry.nameFr}
                  </p>
                ) : null}
              </div>

              {/* License Selection */}
              <div className="card space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-text-main">Nombre de licences</h4>
                    <p className="text-sm text-text-muted">Attribuez des accès à vos collaborateurs</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setLicenseCount(Math.max(1, licenseCount - 1))}
                      className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-text-muted hover:text-text-main hover:bg-white/5 transition-all"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-2xl font-black text-text-main w-12 text-center">{licenseCount}</span>
                    <button
                      onClick={() => setLicenseCount(licenseCount + 1)}
                      className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-text-muted hover:text-text-main hover:bg-white/5 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Prix unitaire</span>
                    <span className="text-text-main font-medium">{unitPrice.toLocaleString()} {displayCurrency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Nombre de licences</span>
                    <span className="text-text-main font-medium">× {licenseCount}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-white/5">
                    <span className="font-bold text-text-main">Total</span>
                    <span className="text-2xl font-black text-primary">{totalPrice.toLocaleString()} {displayCurrency}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("details")}
                  className="btn btn-secondary flex-1"
                >
                  Retour
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={checkoutMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Payer {totalPrice.toLocaleString()} {displayCurrency}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "details" && (
          <div className="mt-auto border-t border-white/5 bg-surface/60 backdrop-blur-2xl px-10 py-5 shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 max-w-3xl mx-auto">
              <div className="flex items-center gap-8">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Prix par licence</p>
                    <div className="flex gap-1 bg-white/5 p-0.5 rounded-md">
                      {(["XAF", "EUR", "USD"] as const).map((curr) => (
                        <button
                          key={curr}
                          onClick={() => setDisplayCurrency(curr)}
                          className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded transition-all",
                            displayCurrency === curr
                              ? "bg-primary text-white shadow-glow-sm"
                              : "text-text-muted hover:text-white"
                          )}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-primary tracking-tighter">
                      {unitPrice.toLocaleString(undefined, { maximumFractionDigits: displayCurrency === "XAF" ? 0 : 2 })}
                    </span>
                    <span className="text-sm font-bold text-primary/80 italic uppercase">{displayCurrency}</span>
                  </div>
                </div>

                <div className="h-10 w-px bg-white/10 hidden sm:block" />

                <div className="hidden md:block">
                  <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Contrat</p>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-success" />
                    <span className="text-[11px] font-bold text-text-main whitespace-nowrap">
                      {isCatalog ? "Catalogue" : "Enterprise"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
                <button
                  disabled={checkoutMutation.isPending}
                  onClick={() => setStep("purchase")}
                  className={cn(
                    "btn h-12 px-10 text-xs font-black shadow-glow group relative overflow-hidden rounded-xl w-full sm:w-auto",
                    isCatalog ? "btn-primary" : "btn-secondary"
                  )}
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCatalog ? (
                    <>
                      Acheter des licences
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  ) : (
                    <>
                      Ajouter des licences
                      <Plus className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
                {!isCatalog && (
                  <p className="text-[10px] text-text-muted">
                    Package acquis • {pkg.total_licenses || 0} licences totales
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
