import { createFileRoute } from "@tanstack/react-router";

import { BridgeDownloadActions, BridgeExplainer, BridgeStepList } from "@/components/kocel/bridge-steps";
import { PageHeader } from "@/components/kocel/page-header";
import { SectionCard } from "@/components/kocel/states";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_app/help")({
  component: HelpPage,
});

const faqs = [
  {
    question: "Is Kocel a broker?",
    answer:
      "No. Kocel Forex Hub is an independent trading-management platform. You keep your broker account and connect it to Kocel through the Kocel Bridge EA.",
  },
  {
    question: "Which MT5 brokers are supported?",
    answer:
      "Support is added broker by broker. The Settings → MT5 Accounts screen shows each broker's current status, and unsupported brokers are clearly marked.",
  },
  {
    question: "Does Kocel need my broker password?",
    answer:
      "No. Kocel never asks for your MT5 trading password. Connectivity is established by the Bridge EA running inside your own terminal using a Kocel connection code.",
  },
  {
    question: "Why is my account showing no balance?",
    answer:
      "Kocel never simulates figures. Balance, equity and prices appear only once your MT5 terminal reports them through the Bridge EA.",
  },
  {
    question: "Can I connect more than one MT5 account?",
    answer:
      "Yes. Add as many accounts as you need and switch between them from the account switcher in the top bar.",
  },
];

function HelpPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Help & Documentation"
        description="How the Kocel Bridge EA connects your MT5 terminal to your Kocel workspace."
      />

      <SectionCard title="Kocel Bridge EA setup">
        <BridgeExplainer />
        <div className="mt-4">
          <BridgeStepList />
        </div>
        <div className="mt-4">
          <BridgeDownloadActions />
        </div>
      </SectionCard>

      <SectionCard title="Frequently asked questions">
        <Accordion type="single" collapsible>
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.question} value={`item-${index}`}>
              <AccordionTrigger className="text-sm">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SectionCard>
    </div>
  );
}
