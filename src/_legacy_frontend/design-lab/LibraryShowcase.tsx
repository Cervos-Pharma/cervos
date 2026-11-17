"use client";

import React, { useState } from "react";
import {
  Badge,
  BarChart,
  Button,
  Card,
  CardHeader,
  ChatPanel,
  EmptyState,
  ExpiryBadge,
  Icon,
  ICON_NAMES,
  Input,
  Money,
  Notice,
  ProgressRing,
  Stat,
  color,
  type ChatPanelMessage,
} from "@cervos/ui";

const SWATCHES: Array<[string, string]> = [
  ["Canvas", color.canvas],
  ["Surface", color.surface],
  ["Border", color.border],
  ["Ink", color.ink],
  ["Muted text", color.inkMuted],
  ["Primary", color.primary],
  ["Success", color.success],
  ["Warning", color.warning],
  ["Danger", color.danger],
  ["Info", color.info],
];

const SALES = [
  { label: "08h", value: 42 },
  { label: "10h", value: 68 },
  { label: "12h", value: 91 },
  { label: "14h", value: 74 },
  { label: "16h", value: 58 },
  { label: "Now", value: 83, highlight: true },
];

function reply(text: string): string {
  const q = text.toLowerCase();
  if (q.includes("stock") || q.includes("amox")) return "Amox 500 has 46 boxes left. Batch LOT-A24 expires first, in 18 days.";
  if (q.includes("sale") || q.includes("today")) return "Sales today are TZS 1,284,000. That is 12% more than yesterday.";
  if (q.includes("deliver") || q.includes("bahari")) return "The Bahari order is on the way. It should arrive in about 20 minutes.";
  return "I can help with stock, sales, and deliveries. Try one of the suggestions.";
}

export default function LibraryShowcase() {
  const [depth, setDepth] = useState(true);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatPanelMessage[]>([
    { id: "m0", role: "assistant", text: "Good morning. What do you need to know?", time: "08:00" },
  ]);

  const send = (text: string) => {
    const now = new Date().toTimeString().slice(0, 5);
    setMessages((prev) => [
      ...prev,
      { id: `u${prev.length}`, role: "user", text, time: now },
      { id: `a${prev.length}`, role: "assistant", text: reply(text), time: now },
    ]);
    setInput("");
  };

  return (
    <section aria-labelledby="library-title" className="bg-[#F5F3EE] px-4 py-12 text-[#1E2522] sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1F5F5B]">@cervos/ui</p>
            <h2 id="library-title" className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              The Cervos component library
            </h2>
            <p className="mt-2 text-lg text-[#545C57]">
              One set of parts for every Cervos screen. Calm colors, large readable text, plain words, and no emojis.
            </p>
          </div>
          <Button variant="secondary" icon="layers" onClick={() => setDepth((d) => !d)}>
            {depth ? "3D cards on" : "3D cards off"}
          </Button>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card elevation={depth ? "depth" : "raised"}>
            <Stat label="Sales today" value={<Money amount={1284000} />} change="+12% vs yesterday" trend="up" />
          </Card>
          <Card elevation={depth ? "depth" : "raised"}>
            <Stat label="Items low on stock" value="7" change="3 more than last week" trend="down" />
          </Card>
          <Card elevation={depth ? "depth" : "raised"}>
            <Stat label="Deliveries on the way" value="2" change="Next one in 20 min" />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card elevation={depth ? "depth" : "raised"}>
            <CardHeader title="Sales by hour" description="Boxes sold, today" />
            <BarChart data={SALES} depth={depth} label="Boxes sold by hour" />
          </Card>
          <Card elevation={depth ? "depth" : "raised"}>
            <CardHeader title="Daily goals" description="How the branch is doing" />
            <ProgressRing
              rings={[
                { label: "Sales goal", value: 78, color: color.primary },
                { label: "Stock health", value: 91, color: color.success },
                { label: "Branch sync", value: 64, color: color.warning },
              ]}
            />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card elevation="raised">
            <CardHeader title="Buttons" />
            <div className="flex flex-wrap gap-3">
              <Button icon="cart">Add to sale</Button>
              <Button variant="secondary" icon="search">Find item</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Remove</Button>
              <Button size="lg" icon="check">Take payment</Button>
              <Button size="sm" busy>Save</Button>
            </div>
            <CardHeader title="Badges" />
            <div className="flex flex-wrap gap-2">
              <Badge>Draft</Badge>
              <Badge tone="primary">New</Badge>
              <Badge tone="success" icon="check">Paid</Badge>
              <Badge tone="warning" icon="clock">Expires soon</Badge>
              <Badge tone="danger" icon="alert">Expired</Badge>
              <Badge tone="info" slanted>On the way</Badge>
              <Badge tone="success" slanted>In stock</Badge>
              <ExpiryBadge expiryDate="2026-12-03" referenceDate="2026-11-15" />
            </div>
          </Card>

          <Card elevation="raised">
            <CardHeader title="Form fields" />
            <div className="flex flex-col gap-4">
              <Input label="Find a medicine" icon="search" placeholder="Name or barcode" value={search} onChange={(e) => setSearch(e.target.value)} hint="Search by name, brand, or barcode." />
              <Input label="Phone number" placeholder="07XX XXX XXX" error={search === "x" ? "Enter a valid phone number." : undefined} />
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChatPanel
            messages={messages}
            input={input}
            onInputChange={setInput}
            onSend={send}
            suggestions={[{ label: "How much Amox is left?" }, { label: "How are sales today?" }, { label: "Where is the Bahari delivery?" }]}
          />
          <div className="flex flex-col gap-4">
            <Notice tone="success" title="Payment received">TZS 18,500 paid by M-Pesa.</Notice>
            <Notice tone="warning" title="Batch expires in 18 days">Sell LOT-A24 first.</Notice>
            <Notice tone="danger" title="Prescription needed">A pharmacist must check this sale.</Notice>
            <EmptyState title="No orders yet" description="New supplier orders will show here." action={<Button size="sm" variant="secondary" icon="plus">New order</Button>} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card elevation="raised">
            <CardHeader title="Colors" description="Warm stone surfaces with one calm teal" />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {SWATCHES.map(([name, hex]) => (
                <li key={name} className="flex flex-col gap-1.5">
                  <span className="h-12 rounded-[8px] border border-[#DDD8CE]" style={{ backgroundColor: hex }} />
                  <span className="text-sm font-medium">{name}</span>
                  <span className="font-mono text-xs text-[#7A817C]">{hex}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card elevation="raised">
            <CardHeader title="Icons" description="Simple line icons. Used in place of emojis." />
            <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {ICON_NAMES.map((name) => (
                <li key={name} className="flex flex-col items-center gap-1.5 rounded-[8px] border border-[#DDD8CE] p-2.5 text-[#1E2522]">
                  <Icon name={name} size={22} />
                  <span className="text-[11px] text-[#545C57]">{name}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  );
}
