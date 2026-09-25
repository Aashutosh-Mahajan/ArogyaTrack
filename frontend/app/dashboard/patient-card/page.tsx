'use client';

import React, { useRef, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Camera,
  Loader2,
  QrCode,
  RefreshCcw,
  RotateCw,
  ShieldCheck,
  Stethoscope,
  User,
} from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { docPaths } from '@/lib/documents';
import { PdfActions } from '@/components/ui/pdf-actions';
import { ErrorState, PageHeader, Panel, Skeleton } from '@/components/ui/page';
import { LogoMark } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';
import type { Allergy, ChronicCondition, PatientCard } from '@/types';
import { t, intlLocale, tn } from '@/lib/i18n';

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function CardFace({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden rounded-[22px] p-6 text-white shadow-ambient-lg [backface-visibility:hidden]',
        'bg-[radial-gradient(120%_140%_at_0%_0%,#1d8a78_0%,#0f5e53_42%,#0a3a34_100%)]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(120deg,transparent_30%,#000)]" />
      <svg className="pointer-events-none absolute -right-6 bottom-8 h-16 w-72 opacity-20" viewBox="0 0 280 40" fill="none">
        <path d="M0 22h60l10-16 12 30 10-22 8 8h60l10-16 12 30 10-22 8 8h40" stroke="white" strokeWidth="2" />
      </svg>
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function PatientCardPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [flipped, setFlipped] = useState(false);

  const cardQ = useQuery<PatientCard>({ queryKey: ['patient-card'], queryFn: () => api.patients.getPatientCard() as Promise<PatientCard> });
  const allergies = useQuery<Allergy[]>({ queryKey: ['patient-allergies'], queryFn: () => api.medical.getAllergies() });
  const conditions = useQuery<ChronicCondition[]>({ queryKey: ['patient-chronic-conditions'], queryFn: () => api.medical.getChronicConditions() });
  const card = cardQ.data;

  const upload = useMutation({
    mutationFn: (file: File) => api.patients.uploadCardPhoto(file),
    onSuccess: () => {
      toast.success(t("Photo updated"));
      queryClient.invalidateQueries({ queryKey: ['patient-card'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("Could not upload the photo")),
  });

  const reissue = useMutation({
    mutationFn: () => api.patients.revokeHealthCard(card!.profile_id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patient-card'] });
      toast.success(t("New card issued. The previous QR no longer works."));
    },
    onError: () => toast.error(t("Could not reissue the card")),
  });

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!['image/jpeg', 'image/png'].includes(f.type)) return toast.error(t("Use a JPG or PNG image"));
    if (f.size > 5 * 1024 * 1024) return toast.error(t("Images must be under 5 MB"));
    upload.mutate(f);
  };

  const activeConditions = (conditions.data ?? []).filter((c) => c.is_active);

  return (
    <div>
      <PageHeader
        title={t("Health card")}
        description={t("Show this QR to a doctor or pharmacist to share your records securely.")}
        actions={card ? <PdfActions path={docPaths.healthCard()} fileName={`Health_card_${card.unique_patient_id || 'card'}.pdf`} size="md" /> : undefined}
      />

      {cardQ.isError ? (
        <ErrorState message={t("Complete your profile to generate a health card.")} onRetry={() => cardQ.refetch()} />
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,560px)_1fr]">
          <div>
            {/* Card */}
            <div className="mx-auto w-full max-w-[560px] [perspective:1400px]">
              <div
                className={cn(
                  'relative aspect-[1.586] w-full transition-transform duration-700 ease-spring [transform-style:preserve-3d]',
                  flipped && '[transform:rotateY(180deg)]'
                )}
              >
                {/* Front */}
                <CardFace>
                  {!card ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white/70" />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <LogoMark className="h-8 w-8 bg-white text-[#0f5e53] shadow-none" />
                          <div className="leading-tight">
                            <div className="text-[15px] font-semibold tracking-tight">ArogyaTrack</div>
                            <div className="text-[10px] uppercase tracking-[0.16em] text-white/60">{t("Health card")}</div>
                          </div>
                        </div>
                        <span className="rounded-md bg-white/15 px-2 py-1 text-[11px] font-semibold backdrop-blur">{card.blood_group || '—'}</span>
                      </div>

                      <div className="mt-auto flex items-end gap-4">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="group relative flex h-[84px] w-[70px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/25"
                          aria-label={t("Change card photo")}
                        >
                          {card.profile_photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.profile_photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-8 w-8 text-white/70" />
                          )}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                            {upload.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                          </span>
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[20px] font-semibold tracking-tight">{card.name}</div>
                          <div className="mt-0.5 font-mono text-[13px] tracking-wider text-white/85">{card.unique_patient_id}</div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-white/70">
                            <span>{t("DOB {fmt}", { fmt: fmt(card.date_of_birth) })}</span>
                            <span className="capitalize">{t(card.gender ? card.gender.charAt(0).toUpperCase() + card.gender.slice(1) : '')}</span>
                            {card.district && <span>{card.district}</span>}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-xl bg-white p-1.5">
                          {card.qr_code_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.qr_code_url} alt={t("Health card QR code")} className="h-[84px] w-[84px]" />
                          ) : (
                            <div className="flex h-[84px] w-[84px] items-center justify-center text-center text-[10px] text-slate-500">{t("QR unavailable")}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardFace>

                {/* Back */}
                <CardFace className="[transform:rotateY(180deg)]">
                  <div className="flex h-full flex-col text-[12.5px]">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{t("Emergency information")}</div>
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                    </div>
                    <div className="mt-4 grid flex-1 grid-cols-2 gap-5">
                      <div>
                        <div className="text-[10.5px] uppercase tracking-[0.12em] text-white/55">{t("Allergies")}</div>
                        <div className="mt-1.5 space-y-0.5">
                          {allergies.data?.length ? allergies.data.slice(0, 5).map((a) => <div key={a.id} className="truncate font-medium">{a.allergen}</div>) : <div className="text-white/60">{t("None recorded")}</div>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10.5px] uppercase tracking-[0.12em] text-white/55">{t("Conditions")}</div>
                        <div className="mt-1.5 space-y-0.5">
                          {activeConditions.length ? activeConditions.slice(0, 5).map((c) => <div key={c.id} className="truncate font-medium">{c.disease_name || c.icd_10_code}</div>) : <div className="text-white/60">{t("None recorded")}</div>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-auto flex items-end justify-between border-t border-white/15 pt-3 text-[11px] text-white/65">
                      <div>{t("Issued {fmt}", { fmt: fmt(card?.issued_at) })}
                        <br />{t("Valid until {fmt}", { fmt: fmt(card?.expires_at) })}
                      </div>
                      <div className="text-right">
                        {card?.phone ? <>{t("Contact {phone}", { phone: card.phone })}<br /></> : null}{t("Blood group {value}", { value: card?.blood_group || '—' })}
                      </div>
                    </div>
                  </div>
                </CardFace>
              </div>
            </div>

            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setFlipped((f) => !f)} className="inline-flex h-9 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13px] font-medium shadow-sm hover:bg-muted">
                <RotateCw className="h-4 w-4" /> {flipped ? t("Show front") : t("Show emergency side")}
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={!card || upload.isPending} className="inline-flex h-9 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13px] font-medium shadow-sm hover:bg-muted disabled:opacity-60">
                <Camera className="h-4 w-4" />{' '}{t("Change photo")}</button>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={onPhoto} />
          </div>

          <div className="space-y-4">
            <Panel title={t("Card status")} icon={ShieldCheck}>
              {!card ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <dl className="grid grid-cols-2 gap-4 text-[13.5px]">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("Issued")}</dt>
                    <dd className="mt-0.5 font-medium">{fmt(card.issued_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("Valid until")}</dt>
                    <dd className="mt-0.5 font-medium">{fmt(card.expires_at)}</dd>
                  </div>
                  <div className="col-span-2 flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    <span>
                      {tn(card.doctors_with_access ?? 0, '1 doctor currently has access to your records', '{count} doctors currently have access to your records')}</span>
                  </div>
                </dl>
              )}
            </Panel>

            <Panel title={t("How your card works")} icon={QrCode}>
              <ol className="space-y-3 text-[13.5px] text-muted-foreground">
                <li className="flex gap-3"><span className="tabular font-semibold text-foreground">1</span>{' '}{t("A verified doctor scans the QR during your visit.")}</li>
                <li className="flex gap-3"><span className="tabular font-semibold text-foreground">2</span>{' '}{t("They get time-limited access to your history, and the access is logged.")}</li>
                <li className="flex gap-3"><span className="tabular font-semibold text-foreground">3</span>{' '}{t("Pharmacists use it to find your prescriptions at the counter.")}</li>
              </ol>
            </Panel>

            <Panel title={t("Lost your card or want to withdraw access?")} icon={RefreshCcw}>
              <p className="text-[13.5px] text-muted-foreground">{t("Reissuing creates a new QR. The old one stops working immediately and doctors lose access until they scan the new card.")}</p>
              <AlertDialog.Root>
                <AlertDialog.Trigger asChild>
                  <button disabled={!card?.profile_id || reissue.isPending} className="mt-4 inline-flex h-9 items-center gap-2 rounded-[10px] border border-destructive/30 px-3.5 text-[13px] font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60">
                    {reissue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}{' '}{t("Reissue card")}</button>
                </AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                  <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-pop data-[state=open]:animate-in data-[state=open]:zoom-in-95">
                    <AlertDialog.Title className="text-[17px] font-semibold">{t("Reissue your health card?")}</AlertDialog.Title>
                    <AlertDialog.Description className="mt-2 text-[14px] text-muted-foreground">{t("Your current QR code will stop working and {value} doctor{value2} with access will need to scan the new card.", { value: card?.doctors_with_access || 'any', value2: card?.doctors_with_access === 1 ? '' : 's' })}</AlertDialog.Description>
                    <div className="mt-6 flex justify-end gap-2">
                      <AlertDialog.Cancel className="h-10 rounded-[10px] border px-4 text-[13.5px] font-medium hover:bg-muted">{t("Cancel")}</AlertDialog.Cancel>
                      <AlertDialog.Action onClick={() => reissue.mutate()} className="h-10 rounded-[10px] bg-destructive px-4 text-[13.5px] font-medium text-destructive-foreground">{t("Reissue card")}</AlertDialog.Action>
                    </div>
                  </AlertDialog.Content>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(PatientCardPage, ['patient']);
