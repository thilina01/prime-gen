#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as cheerio from 'cheerio'; // Correct import for cheerio


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv.length < 3) {
  console.error(chalk.red('Usage: prime-gen <command> <appNameInCamelCase|htmlFilePath>'));
  process.exit(1);
}

const command = process.argv[2];

if (command === 'scaffold') {
  // Existing code for scaffolding Angular PrimeNG components
  if (process.argv.length !== 4) {
    console.error(chalk.red('Usage: prime-gen scaffold <appNameInCamelCase>'));
    process.exit(1);
  }

  const APP_CAMEL = process.argv[3];
const APP_KEBAB = APP_CAMEL.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const PAS = APP_CAMEL.charAt(0).toUpperCase() + APP_CAMEL.slice(1);
const TITLE = APP_CAMEL.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .split(' ')
  .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  .join(' ');

const BASE = path.join('src/app/apps', APP_KEBAB);
fs.mkdirSync(BASE, { recursive: true });

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content.trimStart());
}

writeFile(`${BASE}/${APP_KEBAB}.routes.ts`, `
import { Routes } from '@angular/router';

export const ${APP_CAMEL}Routes: Routes = [
  { path: '', redirectTo: 'table', pathMatch: 'full' },
  {
    path: 'table',
    loadComponent: () =>
      import('@/apps/${APP_KEBAB}/${APP_KEBAB}-table.component').then(m => m.${PAS}TableComponent),
    data: { breadcrumb: 'Table' }
  },
  {
    path: 'form',
    loadComponent: () =>
      import('@/apps/${APP_KEBAB}/${APP_KEBAB}-form.component').then(m => m.${PAS}FormComponent),
    data: { breadcrumb: 'Form' }
  }
];
`);

writeFile(`${BASE}/${APP_KEBAB}-form.component.ts`, `
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';
import {FluidModule} from 'primeng/fluid';
import {SelectModule} from 'primeng/select';
import {FormsModule} from '@angular/forms';
import {TextareaModule} from 'primeng/textarea';

@Component({
  selector: 'app-${APP_KEBAB}-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    ButtonModule,
    CardModule,
    RippleModule,
    FluidModule,
    SelectModule,
    FormsModule,
    TextareaModule
  ],
  templateUrl: './${APP_KEBAB}-form.component.html',
  styleUrls: ['./${APP_KEBAB}-form.component.scss']
})
export class ${PAS}FormComponent implements OnInit {
  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  dropdownItems = [
    {name: 'Option 1', code: 'Option 1'},
    {name: 'Option 2', code: 'Option 2'},
    {name: 'Option 3', code: 'Option 3'}
  ];

  dropdownItem = null;

  ngOnInit(): void {}
}
`);

writeFile(`${BASE}/${APP_KEBAB}-form.component.html`, 
  `<p-fluid>
    <div class="flex flex-col md:flex-row gap-8">
        <div class="md:w-1/2 space-y-4">
            <div class="card flex flex-col gap-4">
                <div class="font-semibold text-xl">Vertical</div>
                <div class="flex flex-col gap-2">
                    <label for="name1">Name</label>
                    <input pInputText id="name1" type="text" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="email1">Email</label>
                    <input pInputText id="email1" type="text" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="age1">Age</label>
                    <input pInputText id="age1" type="text" />
                </div>
            </div>

            <div class="card flex flex-col gap-4">
                <div class="font-semibold text-xl">Vertical Grid</div>
                <div class="flex flex-wrap gap-4">
                    <div class="flex flex-col grow basis-0 gap-2">
                        <label for="name2">Name</label>
                        <input pInputText id="name2" type="text" />
                    </div>
                    <div class="flex flex-col grow basis-0 gap-2">
                        <label for="email2">Email</label>
                        <input pInputText id="email2" type="text" />
                    </div>
                </div>
            </div>
        </div>
        <div class="md:w-1/2 space-y-4">
            <div class="card flex flex-col gap-4">
                <div class="font-semibold text-xl">Horizontal</div>
                <div class="grid grid-cols-12 gap-2">
                    <label for="name3" class="flex items-center col-span-12 mb-2 md:col-span-2 md:mb-0">Name</label>
                    <div class="col-span-12 md:col-span-10">
                        <input pInputText id="name3" type="text" />
                    </div>
                </div>
                <div class="grid grid-cols-12 gap-2">
                    <label for="email3" class="flex items-center col-span-12 mb-2 md:col-span-2 md:mb-0">Email</label>
                    <div class="col-span-12 md:col-span-10">
                        <input pInputText id="email3" type="text" />
                    </div>
                </div>
            </div>

            <div class="card flex flex-col gap-4">
                <div class="font-semibold text-xl">Inline</div>
                <div class="flex flex-wrap items-start gap-4">
                    <div class="field">
                        <label for="firstname1" class="sr-only">Firstname</label>
                        <input pInputText id="firstname1" type="text" placeholder="Firstname" />
                    </div>
                    <div class="field">
                        <label for="lastname1" class="sr-only">Lastname</label>
                        <input pInputText id="lastname1" type="text" placeholder="Lastname" />
                    </div>
                    <p-button label="Submit" [fluid]="false"></p-button>
                </div>
            </div>
            <div class="card flex flex-col gap-4">
                <div class="font-semibold text-xl">Help Text</div>
                <div class="flex flex-wrap gap-2">
                    <label for="username">Username</label>
                    <input pInputText id="username" type="text" />
                    <small>Enter your username to reset your password.</small>
                </div>
            </div>
        </div>
    </div>

    <div class="flex mt-8">
        <div class="card flex flex-col gap-4 w-full">
            <div class="font-semibold text-xl">Advanced</div>
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex flex-wrap gap-2 w-full">
                    <label for="firstname2">Firstname</label>
                    <input pInputText id="firstname2" type="text" />
                </div>
                <div class="flex flex-wrap gap-2 w-full">
                    <label for="lastname2">Lastname</label>
                    <input pInputText id="lastname2" type="text" />
                </div>
            </div>

            <div class="flex flex-wrap">
                <label for="address">Address</label>
                <textarea pTextarea id="address" rows="4"></textarea>
            </div>

            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex flex-wrap gap-2 w-full">
                    <label for="state">State</label>
                    <p-select id="state" [(ngModel)]="dropdownItem" [options]="dropdownItems" optionLabel="name" placeholder="Select One" class="w-full"></p-select>
                </div>
                <div class="flex flex-wrap gap-2 w-full">
                    <label for="zip">Zip</label>
                    <input pInputText id="zip" type="text" />
                </div>
            </div>
        </div>
    </div>
  </p-fluid>`);
writeFile(`${BASE}/${APP_KEBAB}-form.component.scss`, `/* styles for ${APP_KEBAB} form */`);

writeFile(`${BASE}/${APP_KEBAB}-table.component.ts`, `
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';

export interface ${PAS}Item {
  id: number;
  name: string;
}

@Component({
  selector: 'app-${APP_KEBAB}-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TableModule, ButtonModule, RippleModule],
  templateUrl: './${APP_KEBAB}-table.component.html',
  styleUrls: ['./${APP_KEBAB}-table.component.scss']
})
export class ${PAS}TableComponent implements OnInit {
  items: ${PAS}Item[] = [];

  ngOnInit(): void {
    this.items = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' }
    ];
  }

  addItem(): void {
    const nextId = this.items.length + 1;
    this.items = [...this.items, { id: nextId, name: \"Item \${nextId}\" }];
  }
}
`);

writeFile(`${BASE}/${APP_KEBAB}-table.component.html`, `<div class="card">
  <div class="flex justify-between items-center mb-8">
    <span class="text-surface-900 dark:text-surface-0 text-xl font-semibold">
      ${TITLE} Table
    </span>
    <button
      pButton
      pRipple
      class="font-semibold"
      icon="pi pi-plus"
      label="Add New"
      (click)="addItem()"
    ></button>
  </div>

  <div class="table-responsive">
    <p-table [value]="items">
      <ng-template pTemplate="header">
        <tr>
          <th>ID</th>
          <th>Name</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-item>
        <tr>
          <td>{{ item.id }}</td>
          <td>{{ item.name }}</td>
        </tr>
      </ng-template>
    </p-table>
  </div>
</div>`);
writeFile(`${BASE}/${APP_KEBAB}-table.component.scss`, `/* styles for ${APP_KEBAB} table */`);

console.log(chalk.green(`\n✅ Files created under ${BASE}`));
console.log(`\nPaste into src/app/apps/apps.routes.ts:`);
console.log(`{
    path: '${APP_KEBAB}',
    data: { breadcrumb: '${TITLE}' },
    loadChildren: () =>
      import('@/apps/${APP_KEBAB}/${APP_KEBAB}.routes').then(m => m.${APP_CAMEL}Routes)
}`);

console.log(`\nPaste into src/app/layout/components/app.menu.ts:`);
console.log(`{
    label: '${TITLE}',
    icon: 'pi pi-fw pi-file',
    items: [
        { label: 'Table', icon: 'pi pi-fw pi-list', routerLink: ['/apps/${APP_KEBAB}/table'] },
        { label: 'Form',  icon: 'pi pi-fw pi-pencil', routerLink: ['/apps/${APP_KEBAB}/form']  }
    ]
}`);
} else if (command === 'convert-html-to-json') {
  // New functionality to convert HTML to JSON and automatically generate the Tailwind form

  if (process.argv.length !== 4) {
    console.error(chalk.red('Usage: prime-gen convert-html-to-json <htmlFilePath>'));
    process.exit(1);
  }

  const htmlFilePath = process.argv[3];

  // Function to parse HTML and generate JSON output
  const convertHtmlToJson = (htmlFilePath) => {
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    const $ = cheerio.load(htmlContent);

    const formFields = [];

  // Iterate over each input field inside the form
    $('input').each((index, element) => {
      const controlName = $(element).attr('formControlName');
      const inputType = $(element).attr('type') || 'text';

    // Try to find the label associated with this input
    const label = $(element).prev('label').text().trim() || $(element).parent().find('label').text().trim();

    // Build the JSON object for each form input
      const formField = {
        controlName: controlName,
      label: label || 'Untitled', // Default label if none is found
        type: 'input',
        inputType: inputType,
        formControlName: controlName,
      validators: {}, // Add any validation here if necessary
      };

      if ($(element).attr('pInputText')) {
        formField.legacy = { directive: 'pInputText' };
      }

      formFields.push(formField);
    });

    return formFields; // Return as an array for later processing
  };

const toCamelCase = (str) => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w|\s+|\-+|\_+)/g, (match, index) => 
      index === 0 ? match.toLowerCase() : match.toUpperCase()
    )
    .replace(/\s+/g, '')  // Remove spaces
    .replace(/-+/g, '');  // Remove hyphens
};

  // Function to generate Tailwind CSS form HTML
  const generateTailwindForm = (jsonData) => {
    let formHtml = `<p-fluid>
    <div class="flex flex-col md:flex-row gap-8">
        <div class="md:w-1/2 space-y-4">
            <div class="card flex flex-col gap-4">
              <form  [formGroup]="formGroup" class="space-y-4">`;  // Start of the form

    // Loop through each field in the JSON array
    jsonData.forEach(field => {
    const controlName = toCamelCase(field.label); // Convert label to camelCase for ids
    const label = field.label || 'Untitled';

      // Create the form group
      let fieldHtml = `
        <div class="flex flex-col gap-2">
        <label for="${controlName}" class="text-sm font-medium text-gray-700">${label}</label>
          <input
            type="${field.inputType}"
          id="${controlName}"
          name="${controlName}"
          formControlName="${controlName}"
            class="p-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="${label}"
          />
        </div>
      `;

      // Add the field to the form HTML
      formHtml += fieldHtml;
    });

    formHtml += `
      <div class="flex space-x-4">
        <button type="submit" class="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Submit</button>
        <button type="reset" class="p-2 bg-gray-300 text-black rounded-md hover:bg-gray-400">Reset</button>
      </div>
    `;

    formHtml += `
                </form>
            </div>
        </div>
    </div>
  </p-fluid>`;  // End of the form

    return formHtml;
  };

  // Convert the HTML to JSON and generate the form
  try {
    const jsonData = convertHtmlToJson(htmlFilePath);

    // Generate the Tailwind CSS form
    const tailwindForm = generateTailwindForm(jsonData);

    // Output the generated form HTML
    console.log(chalk.green('Generated Tailwind CSS Form:'));
    console.log(tailwindForm);

    // Optionally, save the form HTML to a file
    const outputHtmlFilePath = path.basename(htmlFilePath, '.html') + '-tailwind-form.html';
    fs.writeFileSync(outputHtmlFilePath, tailwindForm, 'utf8');
    console.log(chalk.green(`\n✅ Form HTML output saved to ${outputHtmlFilePath}`));

  } catch (err) {
    console.error(chalk.red(`Error: Unable to process the HTML file: ${err.message}`));
    process.exit(1);
  }
} else {
  console.error(chalk.red(`Unknown command: ${command}`));
  console.error(chalk.red('Usage: prime-gen <command> <appNameInCamelCase|htmlFilePath>'));
  process.exit(1);
}
