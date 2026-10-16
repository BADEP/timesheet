import {Interaction} from "@web/public/interaction";
import {registry} from "@web/core/registry";
import {user} from "@web/core/user";

export class HrTimesheetPortal extends Interaction {
  static selector = "div.hr_timesheet_portal";

  setup() {
    this.orm = this.services.orm;
    this.ui = this.services.ui;
    this.addListener(this.el, "click", this._onClick);
    this.addListener(this.el, "submit", this._onclick_submit);
  }

  _onClick(e) {
    const target = e.target;
    if (target.closest("h5 .fa-plus")) {
      return this._onclick_add();
    }
    if (target.closest("button.submit")) {
      return this._onclick_submit(e);
    }
    if (target.closest("button.cancel")) {
      return this._reload_timesheet();
    }
    if (target.closest("tr[data-line-id].editable i.fa-remove")) {
      e.stopPropagation();
      return this._onclick_delete(e);
    }
    const editRow = target.closest("tr[data-line-id].editable:not(.edit)");
    if (editRow) {
      return this._edit_line(editRow.dataset.lineId);
    }
  }

  async _onclick_delete(e) {
    this.ui.block();
    const line = parseInt(e.target.closest("tr").dataset.lineId, 10);
    try {
      await this.waitFor(this.orm.unlink("account.analytic.line", [line]));
      await this._reload_timesheet();
    } catch (error) {
      this._display_failure(error);
    } finally {
      this.ui.unblock();
    }
  }

  async _onclick_add() {
    const dataset = this.el.dataset;
    this.ui.block();
    try {
      const line_ids = await this.waitFor(
        this.orm.call("account.analytic.line", "create", [
          [
            {
              user_id: user.userId,
              account_id: parseInt(dataset.accountId, 10),
              project_id: parseInt(dataset.projectId, 10),
              task_id: parseInt(dataset.taskId, 10),
              unit_amount: 0,
              name: "/",
            },
          ],
        ])
      );
      await this._reload_timesheet();
      this.waitForTimeout(() => this._edit_line(line_ids), 0);
    } catch (error) {
      this._display_failure(error);
    } finally {
      this.ui.unblock();
    }
  }

  async _onclick_submit(e) {
    e.preventDefault();
    const tr = e.target.closest("tr");
    const form = tr && tr.querySelector("form");
    if (!form) {
      return;
    }
    this.ui.block();
    const data = {};
    for (const input of this.el.querySelectorAll(
      "input[form='hr_timesheet_portal_form']"
    )) {
      data[input.name] = input.value;
    }
    try {
      await this.waitFor(
        this.orm.write("account.analytic.line", [parseInt(tr.dataset.lineId, 10)], data)
      );
      await this._reload_timesheet();
    } catch (error) {
      this._display_failure(error);
    } finally {
      this.ui.unblock();
    }
  }

  async _reload_timesheet() {
    for (const alert of this.el.querySelectorAll(":scope > div.alert")) {
      alert.remove();
    }
    const response = await this.waitFor(fetch(window.location.href));
    const html = await this.waitFor(response.text());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tableTimesheet = document.querySelector(
      ".hr_timesheet_portal .o_portal_my_doc_table"
    );
    const tableSubtotal = document.querySelector(
      ".hr_timesheet_portal .container_subtotal table"
    );
    for (const tbody of tableTimesheet?.querySelectorAll("tbody") || []) {
      tbody.remove();
    }
    for (const tbody of tableSubtotal?.querySelectorAll("tbody") || []) {
      tbody.remove();
    }
    const tbodyTimesheet = doc.querySelector(
      ".hr_timesheet_portal .o_portal_my_doc_table tbody"
    );
    const tbodySubtotal = doc.querySelector(
      ".hr_timesheet_portal .container_subtotal table tbody"
    );
    if (tableTimesheet && tbodyTimesheet && tbodyTimesheet.children.length) {
      tableTimesheet.append(tbodyTimesheet);
    }
    if (tableSubtotal && tbodySubtotal && tbodySubtotal.children.length) {
      tableSubtotal.append(tbodySubtotal);
    }
  }

  _display_failure(error) {
    const alert = document.createElement("div");
    alert.className = "alert alert-danger";
    alert.textContent = error?.data?.message || error?.message || String(error);
    this.el.prepend(alert);
  }

  _edit_line(line_id) {
    const line = this.el.querySelector(`tr[data-line-id="${line_id}"]`);
    if (!line) {
      return;
    }
    for (const row of this.el.querySelectorAll("tbody tr.edit")) {
      row.remove();
    }
    for (const row of this.el.querySelectorAll("tbody tr")) {
      row.style.display = "";
    }
    const edit_line = line.cloneNode(true);
    line.before(edit_line);
    for (const cell of edit_line.querySelectorAll(":scope > [data-field-name]")) {
      const input = document.createElement("input");
      input.className = "form-control";
      input.type = cell.dataset.fieldType || "text";
      input.value = cell.dataset.fieldValue || cell.textContent.trim();
      input.setAttribute("form", "hr_timesheet_portal_form");
      input.name = cell.dataset.fieldName;
      cell.replaceChildren(input);
    }
    edit_line.classList.add("edit");
    const form = document.createElement("form");
    form.id = "hr_timesheet_portal_form";
    const submit = document.createElement("button");
    submit.className = "btn btn-primary submit fa fa-cloud-upload";
    const cancel = document.createElement("button");
    cancel.className = "btn btn-outline-primary cancel fa fa-undo";
    cancel.type = "reset";
    form.append(submit, cancel);
    edit_line.querySelector(":scope > td:last-child").append(form);
    edit_line.querySelector("input")?.focus();
    line.style.display = "none";
  }
}

registry
  .category("public.interactions")
  .add("hr_timesheet_portal.hr_timesheet_portal", HrTimesheetPortal);
