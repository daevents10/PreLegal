import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NdaCreator from "@/components/NdaCreator";
import { GREETING } from "@/lib/chat";
import { completeNda, TERMS } from "./fixtures";

const renderNdaPdf = vi.fn();
vi.mock("@/components/NdaPdf", () => ({ renderNdaPdf: (...args: unknown[]) => renderNdaPdf(...args) }));

const fetchMock = vi.fn();
const preview = () => screen.getByRole("article", { name: "Mutual NDA preview" });
const conversation = () => screen.getByRole("list", { name: "Conversation" });
const chatInput = () => screen.getByLabelText("Message");
const missingStatus = () => screen.queryByText(/^Still needed to download:/);

function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

async function say(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(chatInput(), text);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

describe("NdaCreator (AI chat)", () => {
  beforeEach(() => {
    renderNdaPdf.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = vi.fn(() => "blob:nda");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("greets the user, shows placeholders, and disables download initially", () => {
    render(<NdaCreator terms={TERMS} />);
    expect(within(conversation()).getByText(GREETING.content)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Mutual NDA details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    expect(missingStatus()).toHaveTextContent("Governing Law, Jurisdiction, Party 1 Company");
    expect(within(preview()).getAllByText("[Governing Law]").length).toBeGreaterThan(1);
    expect(chatInput()).toHaveFocus();
  });

  it("renders all Standard Terms clauses from the template", () => {
    render(<NdaCreator terms={TERMS} />);
    const clauses = within(preview()).getAllByRole("listitem");
    expect(clauses).toHaveLength(11);
    expect(clauses[10]).toHaveTextContent(/^11\. General\./);
  });

  it("sends the conversation and fields, then shows the reply and updates the preview", async () => {
    const user = userEvent.setup();
    render(<NdaCreator terms={TERMS} />);
    reply({
      reply: "Great. Which courts should have jurisdiction?",
      fields: { ...completeNda(), jurisdiction: "", mndaTermYears: 3, confidentialityType: "perpetual" },
    });

    await say(user, "Acme and Globex, Delaware law");

    expect(await within(conversation()).findByText("Great. Which courts should have jurisdiction?")).toBeInTheDocument();
    expect(within(conversation()).getByText("Acme and Globex, Delaware law")).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([GREETING, { role: "user", content: "Acme and Globex, Delaware law" }]);
    expect(body.fields.governingLaw).toBe("");

    const doc = preview();
    expect(within(doc).getByText(/Governing Law:/)).toHaveTextContent("Governing Law: Delaware");
    expect(within(doc).getAllByRole("listitem")[8]).toHaveTextContent("laws of the State of Delaware");
    expect(within(doc).getByRole("row", { name: /Company/ })).toHaveTextContent("Acme, Inc.");
    expect(doc).toHaveTextContent("Expires 3 years from Effective Date.");
    expect(doc).toHaveTextContent("In perpetuity.");
    expect(missingStatus()).toHaveTextContent("Still needed to download: Jurisdiction");
    expect(chatInput()).toHaveValue("");
    await waitFor(() => expect(chatInput()).toHaveFocus());
  });

  it("includes earlier turns and the latest fields in follow-up requests", async () => {
    const user = userEvent.setup();
    render(<NdaCreator terms={TERMS} />);
    reply({ reply: "Who signs?", fields: { ...completeNda(), governingLaw: "Texas" } });
    await say(user, "first");
    await within(conversation()).findByText("Who signs?");
    reply({ reply: "Done!", fields: completeNda() });
    await say(user, "second");
    await within(conversation()).findByText("Done!");

    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual([
      GREETING.content,
      "first",
      "Who signs?",
      "second",
    ]);
    expect(body.fields.governingLaw).toBe("Texas");
  });

  it("sends on Enter, inserts a newline on Shift+Enter, and ignores blank messages", async () => {
    const user = userEvent.setup();
    render(<NdaCreator terms={TERMS} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.type(chatInput(), "   {Enter}");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(chatInput());
    await user.type(chatInput(), "line one{Shift>}{Enter}{/Shift}line two");
    expect(chatInput()).toHaveValue("line one\nline two");
    reply({ reply: "Thanks", fields: completeNda() });
    await user.type(chatInput(), "{Enter}");
    await within(conversation()).findByText("Thanks");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages.at(-1).content).toBe("line one\nline two");
  });

  it("shows a thinking indicator and blocks sending while waiting", async () => {
    const user = userEvent.setup();
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
    render(<NdaCreator terms={TERMS} />);

    await say(user, "hello");
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    await user.type(chatInput(), "again");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    resolve(new Response(JSON.stringify({ reply: "Hi there", fields: completeNda() })));
    await within(conversation()).findByText("Hi there");
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["server error detail", () => reply({ detail: "AI chat is not configured" }, 503), "AI chat is not configured"],
    ["non-JSON error", () => fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 })), "unavailable"],
    ["network failure", () => fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")), "Could not reach the server"],
  ])("on %s, shows an error and restores the message for retry", async (_name, arrange, expected) => {
    const user = userEvent.setup();
    render(<NdaCreator terms={TERMS} />);
    arrange();
    await say(user, "Acme and Globex");

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(chatInput()).toHaveValue("Acme and Globex");
    expect(within(conversation()).queryByText("Acme and Globex")).not.toBeInTheDocument();
    expect(within(preview()).getAllByText("[Governing Law]").length).toBeGreaterThan(0);

    reply({ reply: "Got it", fields: completeNda() });
    await user.click(screen.getByRole("button", { name: "Send" }));
    await within(conversation()).findByText("Got it");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("enables download once the chat has gathered every required field", async () => {
    const user = userEvent.setup();
    let connectedDuringClick = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      connectedDuringClick = this.isConnected;
    });
    renderNdaPdf.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    render(<NdaCreator terms={TERMS} />);

    reply({ reply: "All set — you can download the PDF.", fields: completeNda() });
    await say(user, "everything");
    await within(conversation()).findByText("All set — you can download the PDF.");

    const button = screen.getByRole("button", { name: "Download PDF" });
    expect(button).toBeEnabled();
    expect(missingStatus()).not.toBeInTheDocument();

    await user.click(button);
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const [data, terms] = renderNdaPdf.mock.calls[0];
    expect(data.party1.company).toBe("Acme, Inc.");
    expect(terms).toBe(TERMS);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("Mutual-NDA-Acme-Inc-Globex.pdf");
    expect(connectedDuringClick).toBe(true);
    expect(anchor.isConnected).toBe(false);
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:nda"), { timeout: 2000 });
    click.mockRestore();
  });

  it("shows an error if PDF generation fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderNdaPdf.mockRejectedValue(new Error("boom"));
    render(<NdaCreator terms={TERMS} />);
    reply({ reply: "Done", fields: completeNda() });
    await say(user, "everything");
    await within(conversation()).findByText("Done");

    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be generated");
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  });
});
