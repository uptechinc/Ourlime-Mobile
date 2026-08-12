/*
 * Project-specific static checks that are not reliably expressible through
 * Expo's default ESLint configuration. This script intentionally does not
 * build, start Metro, or change source files.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = process.cwd();
const sourceRoots = ['app', 'components', 'lib', 'mobile', 'hooks', 'helpers', 'types'];
const ignoredDirectories = new Set(['node_modules', '.expo', 'dist', 'coverage']);
const requiredSafeAreaEdges = new Set(['top', 'left', 'right']);
const diagnostics = [];

function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : collectSourceFiles(entryPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [entryPath] : [];
  });
}

function report(sourceFile, node, rule, message) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  diagnostics.push({
    column: position.character + 1,
    file: path.relative(projectRoot, sourceFile.fileName).replaceAll('\\', '/'),
    line: position.line + 1,
    message,
    rule,
  });
}

function getImportModuleSpecifier(node) {
  return ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
}

function getSafeAreaAliases(sourceFile) {
  const aliases = new Set();

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement)) {
      return;
    }

    const moduleSpecifier = getImportModuleSpecifier(statement);
    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      return;
    }

    namedBindings.elements.forEach((element) => {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName !== 'SafeAreaView') {
        return;
      }

      if (moduleSpecifier === 'react-native-safe-area-context') {
        aliases.add(element.name.text);
      }

      if (moduleSpecifier === 'react-native') {
        report(sourceFile, element, 'safe-area-source', 'Import SafeAreaView from react-native-safe-area-context, not react-native.');
      }
    });
  });

  return aliases;
}

function getLiteralEdges(attribute) {
  if (!attribute.initializer || !ts.isJsxExpression(attribute.initializer)) {
    return null;
  }

  const expression = attribute.initializer.expression;
  if (!expression || !ts.isArrayLiteralExpression(expression)) {
    return null;
  }

  const edges = new Set();
  expression.elements.forEach((element) => {
    if (ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element)) {
      edges.add(element.text);
    }
  });

  return edges;
}

function checkSafeAreaView(sourceFile, node, safeAreaAliases) {
  const tagName = ts.isIdentifier(node.tagName) ? node.tagName.text : null;
  if (!tagName || !safeAreaAliases.has(tagName)) {
    return;
  }

  const edgesAttribute = node.attributes.properties.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === 'edges',
  );

  if (!edgesAttribute || !ts.isJsxAttribute(edgesAttribute)) {
    report(sourceFile, node, 'safe-area-edges', "SafeAreaView requires edges={['top', 'left', 'right']} (additional edges are allowed).");
    return;
  }

  const edges = getLiteralEdges(edgesAttribute);
  const hasRequiredEdges = edges && [...requiredSafeAreaEdges].every((edge) => edges.has(edge));
  if (!hasRequiredEdges) {
    report(sourceFile, edgesAttribute, 'safe-area-edges', "SafeAreaView edges must explicitly include 'top', 'left', and 'right'.");
  }
}

function checkSourceFile(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, scriptKind);
  const safeAreaAliases = getSafeAreaAliases(sourceFile);

  function visit(node) {
    if (ts.isInterfaceDeclaration(node)) {
      report(sourceFile, node, 'type-aliases', 'Use a type alias instead of an interface.');
    }

    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      report(sourceFile, node, 'no-any', 'Explicit any is not permitted. Use a concrete type or unknown with narrowing.');
    }

    if (ts.isImportDeclaration(node) && getImportModuleSpecifier(node) === 'react') {
      const importClause = node.importClause;
      const namedBindings = importClause?.namedBindings;
      if (importClause?.name || (namedBindings && ts.isNamespaceImport(namedBindings))) {
        report(sourceFile, node, 'no-react-namespace', 'Do not import the React namespace. Import required hooks and types directly from react.');
      }
    }

    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      checkSafeAreaView(sourceFile, node, safeAreaAliases);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const files = sourceRoots.flatMap((sourceRoot) => collectSourceFiles(path.join(projectRoot, sourceRoot)));
files.forEach(checkSourceFile);

if (diagnostics.length === 0) {
  console.log('Discipline check passed (' + files.length + ' TypeScript source files scanned).');
} else {
  diagnostics
    .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column)
    .forEach((diagnostic) => {
      console.error(diagnostic.file + ':' + diagnostic.line + ':' + diagnostic.column + ' [' + diagnostic.rule + '] ' + diagnostic.message);
    });
  console.error('\nDiscipline check failed with ' + diagnostics.length + ' violation(s) across ' + files.length + ' TypeScript source files.');
  process.exitCode = 1;
}
