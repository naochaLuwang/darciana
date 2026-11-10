'use client';
import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
export function NotificationHistory({ push, emails }: { push: ReactNode; emails: ReactNode }) {
  return (
    <Tabs defaultValue="push" className="gap-4">
      <TabsList aria-label="Sending history">
        <TabsTrigger value="push">Push notifications</TabsTrigger>
        <TabsTrigger value="emails">Order emails</TabsTrigger>
      </TabsList>
      <TabsContent value="push">{push}</TabsContent>
      <TabsContent value="emails">{emails}</TabsContent>
    </Tabs>
  );
}
