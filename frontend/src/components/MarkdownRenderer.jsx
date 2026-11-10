import React from 'react';

/**
 * 簡易數學公式清理與格式化 (移除反斜線雜訊，轉換常用希臘與運算符號)
 */
function formatMathSymbol(expr) {
  if (!expr) return '';
  return expr
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\le(q)?/g, '≤')
    .replace(/\\ge(q)?/g, '≥')
    .replace(/\\ne(q)?/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\pi/g, 'π')
    .replace(/\\cdot/g, '·')
    .replace(/\\sum/g, '∑')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\/g, ''); // 移除殘餘的反斜線
}

/**
 * 行內 Markdown 渲染器 (支援粗體、行內代碼、來源標籤、行內 LaTeX 公式)
 */
function renderInlineContent(text) {
  if (!text) return null;

  // 1. 先處理行內 LaTeX: \( ... \) 或 $ ... $
  const mathRegex = /(\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.substring(lastIndex, match.index) });
    }

    let mathExpr = match[0];
    if (mathExpr.startsWith('\\(') && mathExpr.endsWith('\\)')) {
      mathExpr = mathExpr.slice(2, -2);
    } else if (mathExpr.startsWith('$') && mathExpr.endsWith('$')) {
      mathExpr = mathExpr.slice(1, -1);
    }

    parts.push({ type: 'math', value: formatMathSymbol(mathExpr) });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.substring(lastIndex) });
  }

  // 2. 針對 text 部分處理 粗體 **...**、行內代碼 `...`、來源標籤 [來源 x]
  return parts.map((part, pIdx) => {
    if (part.type === 'math') {
      return (
        <span
          key={pIdx}
          style={{
            fontStyle: 'italic',
            fontFamily: 'serif',
            backgroundColor: '#f1f5f9',
            padding: '0.1rem 0.35rem',
            borderRadius: '4px',
            color: '#0f172a',
            fontSize: '0.95em',
            margin: '0 0.15rem',
            border: '1px solid #e2e8f0',
          }}
        >
          {part.value}
        </span>
      );
    }

    // 處理文字內的粗體、代碼與來源標記
    const subParts = [];
    const inlineRegex = /(\*\*.*?\*\*|`.*?`|\[來源\s*\d+\])/g;
    let sLastIndex = 0;
    let sMatch;

    while ((sMatch = inlineRegex.exec(part.value)) !== null) {
      if (sMatch.index > sLastIndex) {
        subParts.push(part.value.substring(sLastIndex, sMatch.index));
      }
      const token = sMatch[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        subParts.push(
          <strong key={`${pIdx}-${sMatch.index}`} style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        subParts.push(
          <code
            key={`${pIdx}-${sMatch.index}`}
            style={{
              backgroundColor: '#f1f5f9',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              fontSize: '0.85em',
              color: '#d97706',
              fontFamily: 'monospace',
            }}
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('[來源') && token.endsWith(']')) {
        subParts.push(
          <span
            key={`${pIdx}-${sMatch.index}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: 'var(--primary)',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '4px',
              padding: '0.05rem 0.35rem',
              margin: '0 0.2rem',
              verticalAlign: 'baseline',
            }}
          >
            {token}
          </span>
        );
      }
      sLastIndex = sMatch.index + token.length;
    }

    if (sLastIndex < part.value.length) {
      subParts.push(part.value.substring(sLastIndex));
    }

    return <React.Fragment key={pIdx}>{subParts}</React.Fragment>;
  });
}

/**
 * 完整 Markdown 與 Math 渲染元件
 */
export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  // 1. 分解區塊層級元素 (Display Math, Tables, Code Blocks, Quotes, Headings, Lists, Paragraphs)
  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // (A) Display Math Block: \[ ... \] 或 $$ ... $$
    if (line.trim().startsWith('\\[') || line.trim().startsWith('$$')) {
      const isBracket = line.trim().startsWith('\\[');
      const closeMarker = isBracket ? '\\]' : '$$';
      let mathContent = line.trim().replace(/^(\\\[|\$\$)/, '');
      if (mathContent.includes(closeMarker)) {
        mathContent = mathContent.replace(new RegExp(`${closeMarker.replace(/\\/g, '\\\\')}.*$`), '');
        elements.push({
          type: 'display-math',
          content: formatMathSymbol(mathContent),
        });
        i++;
        continue;
      }

      const mathLines = [mathContent];
      i++;
      while (i < lines.length && !lines[i].includes(closeMarker)) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        mathLines.push(lines[i].replace(new RegExp(`${closeMarker.replace(/\\/g, '\\\\')}.*$`), ''));
        i++;
      }
      elements.push({
        type: 'display-math',
        content: formatMathSymbol(mathLines.join('\n')),
      });
      continue;
    }

    // (B) Code Block: ```lang
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // 跳過結尾 ```
      elements.push({
        type: 'code-block',
        lang,
        content: codeLines.join('\n'),
      });
      continue;
    }

    // (C) Table Block: 包含 | 且下一行帶有 | --- | 分隔線
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
      if (nextLine.startsWith('|') && nextLine.includes('---')) {
        const headerRow = line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const dataRows = [];
        i += 2; // 跳過標頭與分隔線

        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          const rowCells = lines[i].split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          dataRows.push(rowCells);
          i++;
        }

        elements.push({
          type: 'table',
          headers: headerRow,
          rows: dataRows,
        });
        continue;
      }
    }

    // (D) Headings (#, ##, ###)
    if (/^#{1,4}\s+/.test(line)) {
      const level = line.match(/^#{1,4}/)[0].length;
      const text = line.replace(/^#{1,4}\s+/, '');
      elements.push({
        type: 'heading',
        level,
        text,
      });
      i++;
      continue;
    }

    // (E) Blockquote (> ...)
    if (line.trim().startsWith('>')) {
      const quoteLines = [line.trim().replace(/^>\s?/, '')];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push({
        type: 'quote',
        content: quoteLines.join('\n'),
      });
      continue;
    }

    // (F) Lists (- , * , 1. )
    if (/^(\s*[-*]|\s*\d+\.)\s+/.test(line)) {
      const listItems = [line];
      i++;
      while (i < lines.length && /^(\s*[-*]|\s*\d+\.)\s+/.test(lines[i])) {
        listItems.push(lines[i]);
        i++;
      }
      elements.push({
        type: 'list',
        items: listItems,
      });
      continue;
    }

    // (G) 空行
    if (line.trim() === '') {
      i++;
      continue;
    }

    // (H) 一般段落文字
    const pLines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('\\[') &&
      !lines[i].trim().startsWith('$$') &&
      !lines[i].trim().startsWith('|') &&
      !/^(\s*[-*]|\s*\d+\.)\s+/.test(lines[i])
    ) {
      pLines.push(lines[i]);
      i++;
    }

    elements.push({
      type: 'paragraph',
      text: pLines.join('\n'),
    });
  }

  // 2. 渲染各元素為標準 HTML 與美化樣式
  return (
    <div style={{ lineHeight: '1.65', fontSize: '0.9rem', color: 'inherit' }}>
      {elements.map((el, index) => {
        switch (el.type) {
          case 'display-math':
            return (
              <div
                key={index}
                style={{
                  margin: '0.75rem 0',
                  padding: '0.6rem 1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontFamily: 'serif',
                  fontStyle: 'italic',
                  fontSize: '1.05rem',
                  color: '#0f172a',
                  overflowX: 'auto',
                }}
              >
                {el.content}
              </div>
            );

          case 'table':
            return (
              <div
                key={index}
                style={{
                  overflowX: 'auto',
                  margin: '0.75rem 0',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      {el.headers.map((h, hIdx) => (
                        <th key={hIdx} style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#334155' }}>
                          {renderInlineContent(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {el.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        style={{
                          backgroundColor: rIdx % 2 === 1 ? '#f8fafc' : '#ffffff',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ padding: '0.45rem 0.75rem', color: '#1e293b' }}>
                            {renderInlineContent(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'heading': {
            const size = el.level === 1 ? '1.15rem' : el.level === 2 ? '1.05rem' : '0.95rem';
            return (
              <div
                key={index}
                style={{
                  fontWeight: 700,
                  fontSize: size,
                  marginTop: '0.85rem',
                  marginBottom: '0.35rem',
                  color: 'var(--primary)',
                }}
              >
                {renderInlineContent(el.text)}
              </div>
            );
          }

          case 'quote':
            return (
              <blockquote
                key={index}
                style={{
                  borderLeft: '4px solid var(--primary)',
                  backgroundColor: '#f8fafc',
                  padding: '0.4rem 0.75rem',
                  margin: '0.5rem 0',
                  borderRadius: '0 4px 4px 0',
                  color: '#475569',
                  fontStyle: 'normal',
                }}
              >
                {renderInlineContent(el.content)}
              </blockquote>
            );

          case 'code-block':
            return (
              <pre
                key={index}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  overflowX: 'auto',
                  margin: '0.65rem 0',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                }}
              >
                <code>{el.content}</code>
              </pre>
            );

          case 'list':
            return (
              <ul key={index} style={{ paddingLeft: '1.25rem', margin: '0.4rem 0' }}>
                {el.items.map((item, itemIdx) => {
                  const itemClean = item.replace(/^(\s*[-*]|\s*\d+\.)\s+/, '');
                  return (
                    <li key={itemIdx} style={{ marginBottom: '0.2rem' }}>
                      {renderInlineContent(itemClean)}
                    </li>
                  );
                })}
              </ul>
            );

          case 'paragraph':
          default:
            return (
              <p key={index} style={{ marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                {renderInlineContent(el.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
