#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { Project, SyntaxKind } from 'ts-morph';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_API = process.env.PRIMEGEN_API_URL || 'http://localhost:8080/api';

if (process.argv.length !== 4) {
  console.error(chalk.red('Usage: prime-gen <appNameInCamelCase> <htmlFilePath>'));
  process.exit(1);
}

function toCamelCase(str) {
  return str
    .replace(/[-_ ]+./g, s => s.charAt(s.length - 1).toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[A-Z]/, s => s.toLowerCase());
}

const rawAppName = process.argv[2];
const HTML_FILE_PATH = process.argv[3];

const APP_CAMEL = toCamelCase(rawAppName);
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

function getHtmlFilePath(inputPath) {
  const stats = fs.statSync(inputPath);
  if (stats.isDirectory()) {
    const files = fs.readdirSync(inputPath).filter(file => file.endsWith('.html'));
    if (files.length > 0) return path.join(inputPath, files[0]);
      console.error(chalk.red(`No HTML files found in the directory: ${inputPath}`));
      process.exit(1);
  } else if (stats.isFile() && inputPath.endsWith('.html')) {
    return inputPath;
  } else {
    console.error(chalk.red(`Invalid file or directory path: ${inputPath}`));
    process.exit(1);
  }
}

// ✅ REPLACEMENT: extractFormFieldsToJson using backend API
async function extractFormFieldsToJson() {
  const formHtmlPath = getHtmlFilePath(HTML_FILE_PATH);
  if (!fs.existsSync(formHtmlPath)) {
    console.error(chalk.red(`File not found: ${formHtmlPath}`));
    process.exit(1);
  }
  const formHtml = fs.readFileSync(formHtmlPath, 'utf-8');
  try {
    const response = await fetch(`${BACKEND_API}/extract-form-fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/html' },
      body: formHtml,
    });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  } catch (err) {
    console.error(chalk.red('Error calling extract-form-fields API:'), err.message);
    process.exit(1);
  }
}

// ✅ REPLACEMENT: generateTailwindHTML using backend API
async function generateTailwindHTML(formFieldsJson) {
  try {
    const response = await fetch(`${BACKEND_API}/generate-tailwind-form?title=${encodeURIComponent(TITLE)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formFieldsJson),
    });
    if (!response.ok) throw new Error(await response.text());
    let htmlOutput = await response.text();
    htmlOutput = htmlOutput.replace(/<!--.*?-->/gs, '');
    const start = htmlOutput.indexOf('<div ');
    const end = htmlOutput.lastIndexOf('</div>');
    return (start !== -1 && end !== -1)
      ? htmlOutput.substring(start, end + 6).trim()
      : htmlOutput.trim();
  } catch (err) {
    console.error(chalk.red('Error calling generate-tailwind-form API:'), err.message);
    process.exit(1);
  }
}

async function processFormFile() {
  const formFieldsJson = await extractFormFieldsToJson();
  if (formFieldsJson) {
    const tailwindHtml = await generateTailwindHTML(formFieldsJson);
    writeFile(`${BASE}/${APP_KEBAB}-form.component.html`, tailwindHtml);
    generateInterfaceFile(formFieldsJson);
    generateServiceFile();

    writeFile(`${BASE}/${APP_KEBAB}-form.component.ts`, `
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';
import { FluidModule } from 'primeng/fluid';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';
import { ${PAS}Service } from './${APP_KEBAB}.service';
import { ${PAS} } from './${APP_KEBAB}.model';

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

  constructor(private fb: FormBuilder,
  private ${APP_CAMEL}Service: ${PAS}Service) {}


  ngOnInit(): void {
    this.form = this.fb.group({
      ${generateFormGroup(formFieldsJson)}
    });

    this.${APP_CAMEL}Service.selectedItem$.subscribe(item => {
      if (item) {
        this.form.patchValue(item);
      }
    });
  }

  onSubmit() {
    if (this.form.valid) {
      const formData = this.form.value;
      console.log('Submitted:', formData);
      this.${APP_CAMEL}Service.setSelectedItem(null);
    }
  }
}
`);

    function updateAppsRoutesTs(appKebab, appTitle, appCamel) {
      const project = new Project();
      const filePath = path.resolve('src/app/apps/apps.routes.ts'); // adjust as needed
      const sourceFile = project.addSourceFileAtPath(filePath);

      const routesArray = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.ArrayLiteralExpression);

      const alreadyExists = routesArray.getElements().some(el => el.getText().includes(`path: '${appKebab}'`));

      if (alreadyExists) {
        console.log(chalk.yellow(`⚠️  Route for '${appKebab}' already exists in apps.routes.ts`));
        return;
      }

      const newRoute = `{
    path: '${appKebab}',
    data: { breadcrumb: '${appTitle}' },
    loadChildren: () =>
      import('@/apps/${appKebab}/${appKebab}.routes').then(m => m.${appCamel}Routes)
  }`;

      routesArray.addElement(newRoute);
      sourceFile.saveSync();

      console.log(chalk.green(`✅ Route for '${appKebab}' added to apps.routes.ts`));
    }

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
      ${generateTable(formFieldsJson)}
  </div>
</div>`);

    updateAppsRoutesTs(APP_KEBAB, TITLE, APP_CAMEL);
  }

  writeFile(`${BASE}/${APP_KEBAB}-table.component.ts`, `
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ${PAS}Service } from './${APP_KEBAB}.service';
import { ${PAS} } from './${APP_KEBAB}.model';

@Component({
  selector: 'app-${APP_KEBAB}-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TableModule, ButtonModule, RippleModule],
  templateUrl: './${APP_KEBAB}-table.component.html',
  styleUrls: ['./${APP_KEBAB}-table.component.scss']
})
export class ${PAS}TableComponent implements OnInit {
  items: ${PAS}[] = [];

  constructor(private router: Router,
      private route: ActivatedRoute, 
      private ${APP_CAMEL}Service: ${PAS}Service) { }


  ngOnInit(): void {
      ${generateTableRows(formFieldsJson)}
  }

      ${generateAddItemFunction(formFieldsJson)}


    editItem(id: number) {
        const item = this.items.find(i => i.id === id);
        if (item) {
            this.${APP_CAMEL}Service.setSelectedItem(item);
            this.router.navigate(['../form'], { relativeTo: this.route });
        }
    }
      deleteItem(id: number): void {
        this.items = this.items.filter(item => item.id !== id);
      }

}
`);
}

// Call the function to process the HTML file
processFormFile().catch(err => {
  console.error(chalk.red('Unexpected error:'), err);
  process.exit(1);
});

// Example file generation (kept from your existing script)
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

// Function to generate FormGroup based on JSON
function generateFormGroup(formFieldsJson) {
  const formGroupLines = formFieldsJson.map(field => {
    return `    ${field.formControlName}: new FormControl('', []),`;
  });

  return `
    ${formGroupLines.join('\n')}
`;
}

function generateTable(formFieldsJson) {
  const tableHeaders = formFieldsJson
    .map(field => `<th>${field.label}</th>`)
    .join('\n');

  const tableCells = formFieldsJson
    .map(field => `<td>{{ item.${field.formControlName} }}</td>`)
    .join('\n');

  return `
    <p-table [value]="items">
      <ng-template pTemplate="header">
        <tr>
          ${tableHeaders}
          <th>Actions</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-item>
        <tr>
          ${tableCells}
          <td>
            <div class="flex gap-2">
              <button
                pButton
                icon="pi pi-pencil"
                class="p-button-warning p-button-sm"
                (click)="editItem(item.id)"
                label=""
              ></button>
              <button
                pButton
                icon="pi pi-trash"
                class="p-button-danger p-button-sm"
                (click)="deleteItem(item.id)"
                label=""
              ></button>
            </div>
          </td>
        </tr>
      </ng-template>
    </p-table>
  `;
}

function generateInterfaceFile(formFieldsJson) {
  const lines = formFieldsJson.map(field => {
    const name = field.formControlName;
    const type = (field.type === 'number') ? 'number' : 'string';
    return `  ${name}: ${type};`;
  });

  const interfaceContent = `export interface ${PAS} {\n  id: number;\n${lines.join('\n')}\n}\n`;

  writeFile(`${BASE}/${APP_KEBAB}.model.ts`, interfaceContent);
}

function generateServiceFile() {
  const serviceContent = `
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ${PAS} } from './${APP_KEBAB}.model';

@Injectable({ providedIn: 'root' })
export class ${PAS}Service {
  private _selectedItem = new BehaviorSubject<${PAS} | null>(null);
  selectedItem$ = this._selectedItem.asObservable();

  setSelectedItem(item: ${PAS} | null): void {
    this._selectedItem.next(item);
  }
}
  `.trim();

  writeFile(`${BASE}/${APP_KEBAB}.service.ts`, serviceContent);
}


function generateTableRows(formFieldsJson) {
  const items = [];

  for (let i = 1; i <= 5; i++) {
    const row = { 'id': i };
    formFieldsJson.forEach(field => {
      const key = field.formControlName;
      const type = field.type || 'text';
      if (type === 'number') {
        row[key] = field.formControlName === 'revNo'
          ? 10 + i
          : parseFloat(`${i}.${formFieldsJson.indexOf(field)}`);
      } else {
        row[key] = `${key}_val${i}`;
      }
    });

    items.push(row);
  }

  return `this.items = ${JSON.stringify(items, null, 2)};`;
}

function generateAddItemFunction(formFieldsJson) {
  const rowFields = formFieldsJson.map((field, index) => {
    const key = field.formControlName;
    const type = field.type === 'number' ? 'number' : 'string';

    if (type === 'number') {
      if (key.toLowerCase().includes('id')) {
        return `      ${key}: nextId`;
      }
      if (key.toLowerCase().includes('rev')) {
        return `      ${key}: 10 + nextId`;
      }
      return `      ${key}: nextId + ${index}`;
    } else {
      return `      ${key}: \`${key}_val\${nextId}\``;
    }
  });

  return `  addItem(): void {
    const nextId = this.items.length + 1;
    this.items = [
      ...this.items,
      {
      id: nextId,
${rowFields.join(',\n')}
      }
    ];
  }`;
}

writeFile(`${BASE}/${APP_KEBAB}-form.component.scss`, `/* styles for ${APP_KEBAB} form */`);

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
