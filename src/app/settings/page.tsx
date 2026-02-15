'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@clerk/nextjs';
import { OrganizationProfile } from '@clerk/nextjs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GmailConnectionCard } from '@/components/settings/GmailConnectionCard';
import { GmailCallbackHandler } from '@/components/settings/GmailCallbackHandler';
import { AISettingsPanel } from '@/components/settings/AISettingsPanel';

export default function SettingsPage() {
  const router = useRouter();
  const { organization } = useOrganization();

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <GmailCallbackHandler />
      </Suspense>
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Configuracion</h1>
            {organization && (
              <p className="text-sm text-muted-foreground">{organization.name}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/')}>
            Volver al Dashboard
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="gmail">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="gmail">Gmail</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="team">Equipo</TabsTrigger>
          </TabsList>

          {/* General tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Informacion de la empresa</CardTitle>
                <CardDescription>
                  Datos generales de tu organizacion.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {organization ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Nombre</label>
                      <p className="text-sm font-medium">{organization.name}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Slug</label>
                      <p className="text-sm font-medium">{organization.slug}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Creada</label>
                      <p className="text-sm font-medium">
                        {new Date(organization.createdAt).toLocaleDateString('es-PR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay organizacion activa</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gmail tab */}
          <TabsContent value="gmail">
            <Card>
              <CardHeader>
                <CardTitle>Conexion de Gmail</CardTitle>
                <CardDescription>
                  Administra la cuenta de Gmail conectada para la ingestion de licitaciones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GmailConnectionCard />
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI tab */}
          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle>Configuracion de AI</CardTitle>
                <CardDescription>
                  Personaliza como el AI extrae datos de los PDFs de licitaciones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AISettingsPanel />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team tab */}
          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Equipo</CardTitle>
                <CardDescription>
                  Invita miembros y administra roles de tu organizacion.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OrganizationProfile
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: 'w-full',
                      cardBox: 'shadow-none border-0 w-full',
                      card: 'shadow-none border-0 w-full',
                    },
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
