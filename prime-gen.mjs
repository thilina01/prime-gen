#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as cheerio from 'cheerio';
import { OpenAI } from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the OpenAI API key from environment variable
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.error(chalk.red('Error: OPENAI_API_KEY is not set in the environment.'));
  process.exit(1);
}

// Set up OpenAI client
const openai = new OpenAI({
  apiKey: openaiApiKey // Use the API key from the environment
});

// Ensure the correct number of arguments are passed
if (process.argv.length !== 4) {
  console.error(chalk.red('Usage: prime-gen <appNameInCamelCase> <htmlFilePath>'));
  process.exit(1);
}

const APP_CAMEL = process.argv[2];
const HTML_FILE_PATH = process.argv[3];

const APP_KEBAB = APP_CAMEL.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const PAS = APP_CAMEL.charAt(0).toUpperCase() + APP_CAMEL.slice(1);
const TITLE = APP_CAMEL.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .split(' ')
  .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  .join(' ');

const BASE = path.join('src/app/apps', APP_KEBAB);
fs.mkdirSync(BASE, { recursive: true });

// Function to write content to a file
function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content.trimStart());
}

// Function to handle directory input and get the first HTML file if it's a directory
function getHtmlFilePath(inputPath) {
  const stats = fs.statSync(inputPath);

  if (stats.isDirectory()) {
    // Get all HTML files in the directory
    const files = fs.readdirSync(inputPath).filter(file => file.endsWith('.html'));
    if (files.length > 0) {
      // Return the first HTML file in the directory
      return path.join(inputPath, files[0]);
    } else {
      console.error(chalk.red(`No HTML files found in the directory: ${inputPath}`));
      process.exit(1);
    }
  } else if (stats.isFile() && inputPath.endsWith('.html')) {
    return inputPath;
  } else {
    console.error(chalk.red(`Invalid file or directory path provided: ${inputPath}`));
    process.exit(1);
  }
}

// First prompt: Extract JSON from HTML
async function extractFormFieldsToJson() {
  const formHtmlPath = getHtmlFilePath(HTML_FILE_PATH);

  // Check if the file exists
  if (!fs.existsSync(formHtmlPath)) {
    console.error(chalk.red(`Error: File not found at ${formHtmlPath}`));
    process.exit(1);
  }

  const formHtml = fs.readFileSync(formHtmlPath, 'utf-8');

  // Load the HTML content using cheerio
  const $ = cheerio.load(formHtml);

  // Prepare the prompt to extract form fields into JSON
  const prompt = `
    Extract the labels, input types, formControlNames, and ids from the following HTML form and return them as a JSON array. 
    Do not include any additional instructions, explanations, or text. Just return the raw JSON without any extra information.

    HTML:
    ${formHtml}
  `;

  try {
    // Send the prompt to OpenAI API to extract JSON
    const response = await openai.chat.completions.create({
      model: 'gpt-4',  // Use GPT-4 or another suitable model
      messages: [
        { role: 'system', content: 'You are an assistant that extracts form fields from HTML and returns them as JSON.' },
        { role: 'user', content: prompt }
      ],
    });

    // Get the raw response
    let jsonOutput = response.choices[0].message.content.trim();

    // Log the raw response for debugging
    console.log("Raw JSON response from OpenAI:\n", jsonOutput);

    // More aggressive cleanup: strip unwanted characters before and after the JSON array
    jsonOutput = jsonOutput.match(/\[[\s\S]*?\]/)?.[0];

    // Log the cleaned response for inspection
    console.log("Cleaned JSON response:\n", jsonOutput);

    // Parse the cleaned JSON output
    const formFieldsJson = JSON.parse(jsonOutput);
    return formFieldsJson;
  } catch (err) {
    console.error(chalk.red('Error extracting JSON from HTML:', err));
  }
}

// Second prompt: Generate full Tailwind HTML layout from JSON
async function generateTailwindHTML(formFieldsJson) {
  const prompt = `
    Using the following JSON, generate a full HTML form layout inside this structure, using Tailwind CSS for styling. Each form field should be inside a <div class="field mb-4">, with a label and an input element.

    Here is the base layout:

    <div class="card">
        <div class="flex justify-between items-center mb-8">
            <span class="text-surface-900 dark:text-surface-0 text-xl font-semibold">${TITLE}</span>
        </div>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
        
        <!-- Sample field for style reference - do not include in the response -->
        <div class="field mb-4">
            <label for="name" class="block text-sm font-medium">Name</label>
            <input id="name" type="text" pInputText formControlName="name" class="w-full" />
        </div>
        <!-- Sample field for style reference -->

        <!-- Generated Form Fields Will Go Here -->
        
            <div class="flex justify-end">
                <button pButton pRipple type="submit" label="Submit" [disabled]="form.invalid"></button>
            </div>
        </form>
    </div>

    The form should be populated with fields from the following JSON. Each field should follow this structure:
    - A <div class="field mb-4"> containing:
      - A <label> with a class of "block text-sm font-medium" for the label.
      - An <input> element with the appropriate ID, inputType, and formControlName.
      - Apply Tailwind CSS classes for styling and responsiveness.

    JSON:
    ${JSON.stringify(formFieldsJson)}

    Ensure that each input field is correctly associated with its label using the "for" and "id" attributes. Only return the full HTML form with the fields added, no other text or explanation.
  `;

  try {
    // Send the prompt to OpenAI API to generate the HTML layout
    const response = await openai.chat.completions.create({
      model: 'gpt-4',  // Use GPT-4 or another suitable model
      messages: [
        { role: 'system', content: 'You are a form layout generator using Tailwind CSS.' },
        { role: 'user', content: prompt }
      ],
    });

    // Process the response to extract just the HTML
    let htmlOutput = response.choices[0].message.content;

    // Remove any instructions, comments, or unwanted content from the response
    htmlOutput = htmlOutput.replace(/<!--.*?-->/gs, ''); // Remove comments (style references, etc.)


    // Return the cleaned HTML
    return htmlOutput.trim();

  } catch (err) {
    console.error(chalk.red('Error generating HTML layout from JSON:', err));
  }
}

// Main function to process the HTML file and generate the Tailwind HTML layout
async function processFormFile() {
  // Step 1: Extract the form field data into JSON
  const formFieldsJson = await extractFormFieldsToJson();

  // Step 2: Generate the Tailwind HTML layout based on the extracted JSON
  if (formFieldsJson) {
    const tailwindHtml = await generateTailwindHTML(formFieldsJson);

    // Output the generated HTML layout
    console.log(tailwindHtml);

    // Optionally, write the generated HTML to a file
    writeFile(`${BASE}/${APP_KEBAB}-form.component.html`, tailwindHtml);



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


  ngOnInit(): void {
    this.form = this.fb.group({
      ${generateFormGroup(formFieldsJson)}
    });
  }

    onSubmit() {
        if (this.form.valid) {
            console.log('Form Submitted!', this.form.value);
        } else {
            console.log('Form is invalid');
        }
    }
}
`);
  }
}

// Call the function to process the HTML file
processFormFile().catch(err => {
  console.error(chalk.red('An error occurred:', err));
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
