import { Modal, Setting, type App } from "obsidian";
import { formatBillLine, parseAmount } from "../core/bills";

export class AddTaskModal extends Modal {
  constructor(app: App, private readonly onSubmit: (text: string) => void | Promise<void>) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Add to today");
    let text = "";
    const submit = () => {
      if (!text.trim()) return;
      void this.onSubmit(text.trim());
      this.close();
    };
    new Setting(this.contentEl).setName("Task").addText((t) => {
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
      t.onChange((v) => (text = v));
      window.setTimeout(() => t.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).addButton((b) => b.setButtonText("Add").setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class AddBillModal extends Modal {
  constructor(
    app: App,
    private readonly today: string,
    private readonly onSubmit: (line: string, name: string) => void | Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Add bill");
    let name = "", amount = "", due = this.today;
    const error = this.contentEl.createDiv({ cls: "hw-neg" });
    const submit = () => {
      const a = parseAmount(amount);
      if (!name.trim()) return error.setText("Name is required.");
      if (a === "invalid") return error.setText("Amount should look like 142.18");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return error.setText("Pick a due date.");
      void this.onSubmit(formatBillLine({ name: name.trim(), amount: a, due }), name.trim());
      this.close();
    };
    new Setting(this.contentEl).setName("Name").addText((t) => {
      t.onChange((v) => (name = v));
      window.setTimeout(() => t.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).setName("Amount").setDesc("Optional").addText((t) => t.setPlaceholder("142.18").onChange((v) => (amount = v)));
    new Setting(this.contentEl).setName("Due").addText((t) => {
      t.inputEl.type = "date";
      t.setValue(due).onChange((v) => (due = v));
    });
    this.contentEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    new Setting(this.contentEl).addButton((b) => b.setButtonText("Add bill").setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
