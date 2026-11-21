import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NdaCreator from "@/components/NdaCreator";
import { TERMS } from "./fixtures";

const renderNdaPdf = vi.fn();
vi.mock("@/components/NdaPdf", () => ({ renderNdaPdf: (...args: unknown[]) => renderNdaPdf(...args) }));

const preview = () => screen.getByRole("article", { name: "Mutual NDA preview" });

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Governing Law (state)"), "Delaware");
  await user.type(screen.getByLabelText(/^Jurisdiction/), "New Castle, DE");
  await user.type(document.getElementById("party1-company")!, "Acme");
  await user.type(document.getElementById("party1-name")!, "Ada Lovelace");
  await user.type(document.getElementById("party2-company")!, "Globex");
  await user.type(document.getElementById("party2-name")!, "Alan Turing");
}

describe("NdaCreator", () => {
  beforeEach(() => {
    renderNdaPdf.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:nda");
    URL.revokeObjectURL = vi.fn();
  });

  it("shows placeholders and disables download until required fields are filled", () => {
    render(<NdaCreator terms={TERMS} />);
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Governing Law, Jurisdiction, Party 1 Company");
    expect(within(preview()).getAllByText("[Governing Law]").length).toBeGreaterThan(1);
  });

  it("renders all Standard Terms clauses from the template", () => {
    render(<NdaCreator terms={TERMS} />);
    const clauses = within(preview()).getAllByRole("listitem");
    expect(clauses).toHaveLength(11);
    expect(clauses[10]).toHaveTextContent(/^11\. General\./);
  });

  it("updates the live preview as the user types", async () => {
    const user = userEvent.setup();
    render(<NdaCreator terms={TERMS} />);

    await user.type(screen.getByLabelText("Governing Law (state)"), "Delaware");
    await user.type(screen.getByLabelText(/^Jurisdiction/), "New Castle, DE");
    await user.type(document.getElementById("party1-company")!, "Acme");
    await user.clear(screen.getByLabelText("MNDA term in years"));
    await user.type(screen.getByLabelText("MNDA term in years"), "3");
    await user.click(screen.getByLabelText("In perpetuity"));

    const doc = preview();
    expect(within(doc).getByText(/Governing Law:/)).toHaveTextContent("Governing Law: Delaware");
    // Governing law is inlined into Standard Terms clause 9.
    const clause9 = within(doc).getAllByRole("listitem")[8];
    expect(clause9).toHaveTextContent("laws of the State of Delaware");
    expect(clause9).toHaveTextContent("courts located in New Castle, DE.");
    expect(doc).not.toHaveTextContent("courts located in courts located in");
    expect(within(doc).getByText(/^Jurisdiction:/)).toHaveTextContent("Jurisdiction: courts located in New Castle, DE");
    expect(within(doc).getByRole("row", { name: /Company/ })).toHaveTextContent("Acme");
    expect(doc).toHaveTextContent("Expires 3 years from Effective Date.");
    expect(doc).toHaveTextContent("In perpetuity.");
  });

  it("disables the years input when the open-ended option is chosen", async () => {
    const user = userEvent.setup();
    render(<NdaCreator terms={TERMS} />);
    await user.click(screen.getByLabelText("Continues until terminated"));
    expect(screen.getByLabelText("MNDA term in years")).toBeDisabled();
    expect(preview()).toHaveTextContent("Continues until terminated in accordance with the terms of the MNDA.");
  });

  it("downloads a PDF named after the parties once complete", async () => {
    const user = userEvent.setup();
    let connectedDuringClick = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      connectedDuringClick = this.isConnected;
    });
    renderNdaPdf.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    render(<NdaCreator terms={TERMS} />);

    await fillRequired(user);
    const button = screen.getByRole("button", { name: "Download PDF" });
    expect(button).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(button);
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const [data, terms] = renderNdaPdf.mock.calls[0];
    expect(data.party1.company).toBe("Acme");
    expect(terms).toBe(TERMS);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("Mutual-NDA-Acme-Globex.pdf");
    expect(anchor.href).toBe("blob:nda");
    expect(connectedDuringClick).toBe(true); // attached for the click (Firefox requirement)...
    expect(anchor.isConnected).toBe(false); // ...and removed afterwards
    // URL is revoked after a delay so the browser can start the download first.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:nda"), { timeout: 2000 });
    click.mockRestore();
  });

  it("shows an error if PDF generation fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderNdaPdf.mockRejectedValue(new Error("boom"));
    render(<NdaCreator terms={TERMS} />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be generated");
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  });
});
