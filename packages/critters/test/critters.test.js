/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import Critters from '../src/index';
import fs from 'fs';
import path from 'path';

const trim = (s) =>
  s[0]
    .trim()
    .replace(new RegExp('^' + s[0].match(/^( {2}|\t)+/m)[0], 'gm'), '');

describe('Critters', () => {
  test('Basic Usage', async () => {
    const critters = new Critters({
      reduceInlineStyles: false,
      path: '/'
    });
    const assets = {
      '/style.css': trim`
        h1 { color: blue; }
        h2.unused { color: red; }
        p { color: purple; }
        p.unused { color: orange; }
      `
    };
    critters.readFile = (filename) => assets[filename];
    const result = await critters.process(trim`
      <html>
        <head>
          <link rel="stylesheet" href="/style.css">
        </head>
        <body>
          <h1>Hello World!</h1>
          <p>This is a paragraph</p>
        </body>
      </html>
    `);
    expect(result).toMatch('<style>h1{color:blue}p{color:purple}</style>');
    expect(result).toMatch('<link rel="stylesheet" href="/style.css">');
    expect(result).toMatchSnapshot();
  });

  test('Run on HTML file', async () => {
    const critters = new Critters({
      reduceInlineStyles: false,
      path: path.join(__dirname, 'src')
    });

    const html = fs.readFileSync(
      path.join(__dirname, 'src/index.html'),
      'utf8'
    );

    const result = await critters.process(html);
    expect(result).toMatchSnapshot();
  });

  test('Does not encode HTML', async () => {
    const critters = new Critters({
      reduceInlineStyles: false,
      path: '/'
    });
    const assets = {
      '/style.css': trim`
        h1 { color: blue; }
      `
    };
    critters.readFile = (filename) => assets[filename];
    const result = await critters.process(trim`
      <html>
        <head>
          <title>$title</title>
          <link rel="stylesheet" href="/style.css">
        </head>
        <body>
          <h1>Hello World!</h1>
        </body>
      </html>
    `);
    expect(result).toMatch('<style>h1{color:blue}</style>');
    expect(result).toMatch('<link rel="stylesheet" href="/style.css">');
    expect(result).toMatch('<title>$title</title>');
  });

  test('should keep existing link tag attributes in the noscript link', async () => {
    const critters = new Critters({
      reduceInlineStyles: false,
      path: '/',
      preload: 'media'
    });
    const assets = {
      '/style.css': trim`
        h1 { color: blue; }
      `
    };
    critters.readFile = (filename) => assets[filename];
    const result = await critters.process(trim`
      <html>
        <head>
          <title>$title</title>
          <link rel="stylesheet" href="/style.css" crossorigin="anonymous" integrity="sha384-j1GsrLo96tLqzfCY+">
        </head>
        <body>
          <h1>Hello World!</h1>
        </body>
      </html>
    `);

    expect(result).toMatch('<style>h1{color:blue}</style>');
    expect(result).toMatch(
      `<link rel="stylesheet" href="/style.css" crossorigin="anonymous" integrity="sha384-j1GsrLo96tLqzfCY+" media="print" onload="this.media='all'">`
    );
    expect(result).toMatchSnapshot();
  });

  test('should keep existing link tag attributes', async () => {
    const critters = new Critters({
      reduceInlineStyles: false,
      path: '/',
    });
    const assets = {
      '/style.css': trim`
        h1 { color: blue; }
      `
    };
    critters.readFile = (filename) => assets[filename];
    const result = await critters.process(trim`
      <html>
        <head>
          <title>$title</title>
          <link rel="stylesheet" href="/style.css" crossorigin="anonymous" integrity="sha384-j1GsrLo96tLqzfCY+">
        </head>
        <body>
          <h1>Hello World!</h1>
        </body>
      </html>
    `);

    expect(result).toMatch('<style>h1{color:blue}</style>');
    expect(result).toMatch(
      `<link rel="stylesheet" href="/style.css" crossorigin="anonymous" integrity="sha384-j1GsrLo96tLqzfCY+">`
    );
    expect(result).toMatchSnapshot();
  });

  test('Does not decode entities in HTML document', async () => {
    const critters = new Critters({
      path: '/'
    });
    critters.readFile = (filename) => assets[filename];
    const result = await critters.process(trim`
      <html>
        <body>
          &lt;h1&gt;Hello World!&lt;/h1&gt;
        </body>
      </html>
    `);
    expect(result).toMatch('&lt;h1&gt;Hello World!&lt;/h1&gt;');
  });

  test('Prevent injection via media attr', async () => {
    const critters = new Critters({
      reduceInlineStyles: false,
      path: path.join(__dirname, 'src'),
      preload: 'media'
    });

    const html = fs.readFileSync(
      path.join(__dirname, 'src/media-validation.html'),
      'utf8'
    );

    const result = await critters.process(html);
    expect(result).toMatchSnapshot();
  });

  test('Skip invalid path', async () => {
    const consoleSpy = jest.spyOn(console, 'warn');

    const critters = new Critters({
      reduceInlineStyles: false,
      path: path.join(__dirname, 'src')
    });

    const html = fs.readFileSync(
      path.join(__dirname, 'src/subpath-validation.html'),
      'utf8'
    );

    const result = await critters.process(html);
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Unable to locate stylesheet')
    );
    expect(result).toMatchSnapshot();
  });

  it('should not load stylesheets outside of the base path', async () => {
    const critters = new Critters({ path: '/var/www' });
    jest.spyOn(critters, 'readFile');
    await critters.process(`
        <html>
            <head>
                <link rel=stylesheet href=/file.css>
                <link rel=stylesheet href=/../../../company-secrets/secret.css>
            </head>
            <body></body>
        </html>
    `);
    expect(critters.readFile).toHaveBeenCalledWith('/var/www/file.css');
    expect(critters.readFile).not.toHaveBeenCalledWith(
      '/company-secrets/secret.css'
    );
  });
});
