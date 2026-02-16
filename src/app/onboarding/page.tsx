'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOrganizationList, useOrganization, CreateOrganization } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type Step = 'org' | 'gmail' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'org', label: 'Empresa' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'done', label: 'Listo' },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const { isLoaded, userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  // Determine initial step: query param or org existence
  const queryStep = searchParams.get('step') as Step | null;
  const initialStep = queryStep && ['org', 'gmail', 'done'].includes(queryStep)
    ? queryStep
    : organization ? 'gmail' : 'org';
  const [step, setStep] = useState<Step>(initialStep);
  const [gmailStatus, setGmailStatus] = useState<'idle' | 'connecting' | 'connected' | 'skipped'>('idle');

  // Auto-activate org for invited users: if user has memberships but no
  // active org, set the first membership as active and redirect to dashboard.
  useEffect(() => {
    if (!isLoaded || !setActive) return;
    if (organization) return; // already has an active org

    const memberships = userMemberships?.data;
    if (memberships && memberships.length > 0) {
      const firstOrg = memberships[0].organization;
      setActive({ organization: firstOrg.id }).then(() => {
        router.replace('/');
      });
    }
  }, [isLoaded, organization, userMemberships?.data, setActive, router]);

  // Single-org enforcement: if user already has an org and lands on
  // the org-creation step, redirect to dashboard.
  useEffect(() => {
    if (isLoaded && organization && step === 'org' && !queryStep) {
      router.replace('/');
      return;
    }
    // Advance to gmail step when org is just created (via queryStep or org detection)
    if (organization && step === 'org') {
      setStep('gmail');
    }
  }, [isLoaded, organization, step, queryStep, router]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const handleConnectGmail = async () => {
    setGmailStatus('connecting');
    try {
      const res = await fetch('/api/settings/gmail/connect');
      const data = await res.json();
      if (data.success && data.data?.authUrl) {
        window.location.href = data.data.authUrl;
      } else {
        toast.error(data.error || 'Error al conectar Gmail');
        setGmailStatus('idle');
      }
    } catch {
      toast.error('Error al conectar Gmail');
      setGmailStatus('idle');
    }
  };

  const handleSkipGmail = () => {
    setGmailStatus('skipped');
    setStep('done');
  };

  const handleFinish = () => {
    router.push('/');
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Bienvenido a Licitaciones</h1>
          <p className="text-muted-foreground text-sm">
            Configura tu empresa en unos pasos
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < currentStepIndex
                    ? 'bg-emerald-600 text-white'
                    : i === currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < currentStepIndex ? '✓' : i + 1}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  i === currentStepIndex ? 'font-medium' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px ${i < currentStepIndex ? 'bg-emerald-600' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === 'org' && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 1: Crear tu empresa</CardTitle>
              <CardDescription>
                Crea una organizacion para tu empresa. Podras invitar miembros de tu equipo despues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateOrganization
                afterCreateOrganizationUrl="/onboarding?step=gmail"
                skipInvitationScreen
              />
            </CardContent>
          </Card>
        )}

        {step === 'gmail' && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 2: Conectar Gmail</CardTitle>
              <CardDescription>
                Conecta la cuenta de Gmail donde recibes las licitaciones para procesarlas automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {gmailStatus === 'connected' ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <span className="text-lg">✓</span>
                  <span className="font-medium">Gmail conectado exitosamente</span>
                </div>
              ) : (
                <>
                  <Button
                    onClick={handleConnectGmail}
                    disabled={gmailStatus === 'connecting'}
                    className="w-full"
                  >
                    {gmailStatus === 'connecting' && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Conectar cuenta de Gmail
                  </Button>
                  <button
                    onClick={handleSkipGmail}
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                  >
                    Omitir por ahora
                  </button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'done' && (
          <Card>
            <CardHeader>
              <CardTitle>Todo listo</CardTitle>
              <CardDescription>
                {gmailStatus === 'skipped'
                  ? 'Tu empresa esta configurada. Puedes conectar Gmail mas tarde en Configuracion.'
                  : 'Tu empresa esta configurada y Gmail esta conectado.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleFinish} className="w-full">
                Ir al Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
