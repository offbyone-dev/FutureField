import { useMemo, useState } from "react";
import {
  HelpCircle,
  Search,
  BookOpen,
  Satellite,
  Sprout,
  CloudSun,
  ExternalLink,
  Phone,
  ChevronDown,
  ArrowRight,
  Landmark,
  Info,
} from "lucide-react";

type Guide = {
  title: string;
  description: string;
  icon: typeof BookOpen;
  steps: string[];
};

const guides: Guide[] = [
  {
    title: "Getting Started",
    description: "Learn how to add and manage your fields.",
    icon: BookOpen,
    steps: [
      "Open Dashboard and select your division and district.",
      "Draw your field boundary on the map.",
      "Enter your farm details and save the field.",
      "Visit My Fields to view or manage saved fields.",
    ],
  },
  {
    title: "Understanding Your Data",
    description: "Understand NASA observations and field indicators.",
    icon: Satellite,
    steps: [
      "Select a saved field from the field selector.",
      "Open Data Explorer to explore environmental observations.",
      "Review rainfall, temperature, root-zone wetness, and available vegetation indicators.",
      "Check the observation period and data availability before making decisions.",
    ],
  },
  {
    title: "Crop & Rotation Planning",
    description: "Explore crop suitability and rotation options.",
    icon: Sprout,
    steps: [
      "Open Crop Analysis to review suitable crop options.",
      "Compare crop suitability scores and their explanations.",
      "Visit Rotation Planner to explore possible crop sequences.",
      "Consider water availability, field conditions, and local farming advice.",
    ],
  },
  {
    title: "Climate Simulations",
    description: "Compare different rainfall, temperature, and water scenarios.",
    icon: CloudSun,
    steps: [
      "Open Simulations and select your saved field.",
      "Adjust rainfall, temperature, and water availability assumptions.",
      "Compare the modeled rotation scores with the baseline.",
      "Read What changed? to understand the scenario results.",
    ],
  },
];

const resources = [
  {
    name: "Crop Zoning",
    organization: "Crop Zoning Information",
    description: "Explore location-based crop suitability and agricultural zoning information.",
    url: "https://cropzoning.gov.bd/",
    category: "Crop Planning",
  },
  {
    name: "Soil Resource Development Institute",
    organization: "SRDI",
    description: "Find information about soil resources, soil testing, and soil management.",
    url: "https://srdi.gov.bd/",
    category: "Soil",
  },
  {
    name: "Department of Agricultural Marketing",
    organization: "DAM",
    description: "Access agricultural market information and commodity price resources.",
    url: "https://dam.gov.bd/",
    category: "Markets",
  },
  {
    name: "Bangladesh Agro-Meteorological Information Service",
    organization: "BAMIS",
    description: "Explore agricultural weather information and agro-meteorological advisories.",
    url: "https://bamis.gov.bd/",
    category: "Weather",
  },
  {
    name: "Bangladesh Rice Research Institute",
    organization: "BRRI",
    description: "Find rice research, improved varieties, and rice cultivation information.",
    url: "https://brri.gov.bd/",
    category: "Research",
  },
  {
    name: "Bangladesh Agricultural Research Institute",
    organization: "BARI",
    description: "Explore agricultural research and crop production technologies.",
    url: "https://bari.gov.bd/",
    category: "Research",
  },
  {
    name: "Agricultural Information Service",
    organization: "AIS",
    description: "Access agricultural publications, educational materials, and information services.",
    url: "https://ais.gov.bd/",
    category: "Information",
  },
  {
    name: "Krishi Portal",
    organization: "Government Agricultural Portal",
    description: "Find agricultural information and government farming services.",
    url: "https://krishi.gov.bd/",
    category: "Government",
  },
  {
    name: "Department of Agricultural Extension",
    organization: "DAE",
    description: "Explore agricultural extension services and farmer support information.",
    url: "https://dae.gov.bd/",
    category: "Support",
  },
];

const faqs = [
  {
    question: "How do I add a new field?",
    answer:
      "Open Dashboard, select your location, and draw your field boundary. Continue to Farm Details, enter your field information, and save it. Your field will then appear in My Fields.",
  },
  {
    question: "Where does FutureField get its environmental data?",
    answer:
      "FutureField integrates NASA environmental observations and available field information. Data sources and observation periods may vary by indicator. Check the relevant page for availability and limitations.",
  },
  {
    question: "Are crop suitability scores guaranteed?",
    answer:
      "No. Crop suitability scores are decision-support estimates, not guarantees of crop performance or yield. Local soil conditions, management practices, pests, and unexpected weather can affect actual results.",
  },
  {
    question: "What is the difference between historical data and simulations?",
    answer:
      "Historical data describes observed past conditions. Simulations explore hypothetical changes to rainfall, temperature, water availability, and planning priorities. They are not weather forecasts.",
  },
  {
    question: "Can I manage multiple fields?",
    answer:
      "Yes. You can save multiple fields and switch between them. Visit My Fields to review your saved field information.",
  },
  {
    question: "Can I use FutureField outside Bangladesh?",
    answer:
      "The current version focuses on Bangladesh. Support for additional countries or regions may be introduced in future versions.",
  },
];

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeGuide, setActiveGuide] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const query = search.trim().toLowerCase();

  const filteredGuides = useMemo(
    () =>
      guides
        .map((guide, index) => ({ ...guide, index }))
        .filter(
          (guide) =>
            !query ||
            [
              guide.title,
              guide.description,
              ...guide.steps,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query)
        ),
    [query]
  );

  const filteredResources = useMemo(
    () =>
      resources.filter(
        (resource) =>
          !query ||
          [
            resource.name,
            resource.organization,
            resource.description,
            resource.category,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
      ),
    [query]
  );

  const filteredFaqs = useMemo(
    () =>
      faqs
        .map((faq, index) => ({ ...faq, index }))
        .filter(
          (faq) =>
            !query ||
            `${faq.question} ${faq.answer}`
              .toLowerCase()
              .includes(query)
        ),
    [query]
  );

  const hasResults =
    filteredGuides.length > 0 ||
    filteredResources.length > 0 ||
    filteredFaqs.length > 0;

  return (
    <div className="min-h-full bg-[#f7f5f0] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1400px] space-y-9">

        {/* HEADER */}
        <section className="rounded-2xl border border-[#dce7df] bg-[#eaf1eb] px-6 py-10 md:px-10">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#174D3B]">
            <HelpCircle className="h-5 w-5" />
            FutureField Support
          </div>

          <h1 className="font-display text-3xl font-semibold text-[#173c2e] md:text-4xl">
            How can we help you?
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#607268] md:text-base">
            Find answers, learn how to use FutureField, and connect
            with agricultural information and support services in Bangladesh.
          </p>

          <div className="mt-7 flex max-w-2xl items-center gap-3 rounded-xl border border-[#d5ded7] bg-white px-4 py-3 shadow-sm">
            <Search className="h-5 w-5 shrink-0 text-[#829188]" />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search guides, agricultural resources, or FAQs..."
              aria-label="Search help content"
              className="w-full bg-transparent text-sm text-[#243b30] outline-none placeholder:text-[#9ba7a0]"
            />
          </div>
        </section>

        {/* QUICK HELP */}
        {filteredGuides.length > 0 && (
          <section>
            <div className="mb-5">
              <h2 className="font-display text-2xl font-semibold text-[#1c352a]">
                Quick Help
              </h2>

              <p className="mt-1 text-sm text-[#78867d]">
                Simple guides to help you get the most out of FutureField.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {filteredGuides.map((guide) => {
                const Icon = guide.icon;

                return (
                  <button
                    key={guide.index}
                    type="button"
                    onClick={() =>
                      setActiveGuide(
                        activeGuide === guide.index
                          ? null
                          : guide.index
                      )
                    }
                    className={`rounded-xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      activeGuide === guide.index
                        ? "border-[#174D3B] ring-1 ring-[#174D3B]/20"
                        : "border-[#e4e4dd] hover:border-[#9eb6a7]"
                    }`}
                  >
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf2ec] text-[#174D3B]">
                      <Icon className="h-5 w-5" />
                    </div>

                    <h3 className="font-semibold text-[#20382c]">
                      {guide.title}
                    </h3>

                    <p className="mt-2 min-h-[60px] text-sm leading-5 text-[#7a857e]">
                      {guide.description}
                    </p>

                    <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#174D3B]">
                      {activeGuide === guide.index
                        ? "Hide guide"
                        : "View guide"}

                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </button>
                );
              })}
            </div>

            {activeGuide !== null &&
              filteredGuides.some(
                (guide) => guide.index === activeGuide
              ) && (
                <div className="mt-4 rounded-xl border border-[#dce7df] bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-[#174D3B]">
                      {guides[activeGuide].title}
                    </h3>

                    <button
                      type="button"
                      onClick={() => setActiveGuide(null)}
                      className="text-xs font-semibold text-[#738277] hover:text-[#174D3B]"
                    >
                      Close
                    </button>
                  </div>

                  <ol className="space-y-3">
                    {guides[activeGuide].steps.map(
                      (step, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-sm leading-6 text-[#526258]"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf2ec] text-xs font-bold text-[#174D3B]">
                            {index + 1}
                          </span>

                          {step}
                        </li>
                      )
                    )}
                  </ol>
                </div>
              )}
          </section>
        )}

        {/* GOVERNMENT RESOURCES */}
        {filteredResources.length > 0 && (
          <section>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e5eee7] text-[#174D3B]">
                <Landmark className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-display text-2xl font-semibold text-[#1c352a]">
                  Bangladesh Agricultural Resources
                </h2>

                <p className="mt-1 text-sm text-[#78867d]">
                  Explore government agricultural information and services.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredResources.map((resource) => (
                <article
                  key={resource.url}
                  className="flex flex-col rounded-xl border border-[#e4e4dd] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className="rounded-full bg-[#edf3ed] px-3 py-1 text-[11px] font-semibold text-[#3b6a4f]">
                      {resource.category}
                    </span>

                    <ExternalLink className="h-4 w-4 text-[#8c9b90]" />
                  </div>

                  <h3 className="text-base font-semibold text-[#24382d]">
                    {resource.name}
                  </h3>

                  <p className="mt-1 text-xs font-medium text-[#648171]">
                    {resource.organization}
                  </p>

                  <p className="mt-3 flex-1 text-sm leading-6 text-[#77847b]">
                    {resource.description}
                  </p>

                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 self-start text-sm font-semibold text-[#174D3B] hover:underline"
                  >
                    Visit Website
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* AGRICULTURAL HELPLINE */}
        {(!query ||
          "agricultural helpline krishi call center 16123 phone farmer support"
            .includes(query)) && (
          <section className="overflow-hidden rounded-2xl bg-[#174D3B] p-6 text-white md:p-8">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/75">
                  <Phone className="h-4 w-4" />
                  Agricultural Helpline
                </div>

                <h2 className="font-display text-2xl font-semibold md:text-3xl">
                  কৃষি কল সেন্টার
                </h2>

                <p className="mt-2 text-3xl font-bold tracking-wide">
                  16123
                </p>

                <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
                  Need farming advice? Contact the agricultural
                  helpline for information about crops, pests,
                  soil, and farming practices.
                </p>
              </div>

              <a
                href="tel:16123"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#174D3B] transition-colors hover:bg-[#edf4ef]"
              >
                <Phone className="h-4 w-4" />
                Call 16123
              </a>
            </div>

            <p className="mt-5 text-xs text-white/60">
              Helpline availability and call charges may vary.
              Please confirm current service details through official channels.
            </p>
          </section>
        )}

        {/* FAQ */}
        {filteredFaqs.length > 0 && (
          <section>
            <div className="mb-5">
              <h2 className="font-display text-2xl font-semibold text-[#1c352a]">
                Frequently Asked Questions
              </h2>

              <p className="mt-1 text-sm text-[#78867d]">
                Answers to common questions about FutureField.
              </p>
            </div>

            <div className="space-y-3">
              {filteredFaqs.map((faq) => (
                <div
                  key={faq.index}
                  className="overflow-hidden rounded-xl border border-[#e4e4dd] bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFaq(
                        openFaq === faq.index ? null : faq.index
                      )
                    }
                    aria-expanded={openFaq === faq.index}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-[#263b2e]">
                      {faq.question}
                    </span>

                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#78867d] transition-transform ${
                        openFaq === faq.index
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </button>

                  {openFaq === faq.index && (
                    <div className="border-t border-[#f0f0eb] px-5 py-4 text-sm leading-7 text-[#6d7d72]">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* NO SEARCH RESULTS */}
        {!hasResults && query && (
          <div className="rounded-xl border border-[#e4e4dd] bg-white px-6 py-12 text-center">
            <Search className="mx-auto mb-4 h-8 w-8 text-[#a5b1a8]" />

            <h3 className="font-semibold text-[#263b2e]">
              No matching help content found
            </h3>

            <p className="mt-2 text-sm text-[#78867d]">
              Try searching for crops, NASA data, weather,
              soil, or field management.
            </p>
          </div>
        )}

        {/* DISCLAIMER */}
        <div className="flex items-start gap-3 rounded-xl border border-[#dce7df] bg-[#edf3ee] p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#47705a]" />

          <p className="text-xs leading-6 text-[#617367]">
            FutureField provides data-driven agricultural decision
            support and does not replace local agricultural expertise.
            External websites and helplines are operated by their
            respective organizations.
          </p>
        </div>

      </div>
    </div>
  );
}