import { getCurrentPageText } from './chromeTabs'

interface PageAnswer {
  answer: string
  pageTitle: string
}

function normalize(_value: string): string {
  return _value.replace(/\s+/g, ' ').trim()
}

function extractAfterAnchor(_text: string, _anchor: string): string | null {
  const _lines = _text
    .split(/\r?\n/)
    .map((_line) => normalize(_line.replace(/^[\s\-*•\d.)]+/, '')))
    .filter(Boolean)
  const _anchorLower = _anchor.toLowerCase()

  for (let _i = 0; _i < _lines.length; _i++) {
    if (!_lines[_i].toLowerCase().includes(_anchorLower)) {
      continue
    }
    const _sameLineParts = _lines[_i]
      .split(/\s*(?:,|;|->|→|\|)\s*/)
      .map((_part) => normalize(_part))
      .filter(Boolean)
    const _sameLineIndex = _sameLineParts.findIndex((_part) =>
      _part.toLowerCase().includes(_anchorLower)
    )
    if (_sameLineIndex >= 0 && _sameLineParts[_sameLineIndex + 1]) {
      return _sameLineParts[_sameLineIndex + 1]
    }
    for (let _j = _i + 1; _j < _lines.length; _j++) {
      if (!_lines[_j].toLowerCase().includes(_anchorLower)) {
        return _lines[_j]
      }
    }
  }

  const _index = _text.toLowerCase().indexOf(_anchorLower)
  if (_index === -1) {
    return null
  }
  const _after = _text.slice(_index + _anchor.length)
  const _match = _after.match(/(?:[,;:\n\r\-–—>]+|\s+)([^\n\r.;,]{2,160})/)
  return _match?.[1] ? normalize(_match[1]) : null
}

function inferAnchor(_query: string, _anchorText?: string): string | null {
  const _explicit = _anchorText?.trim()
  if (_explicit) {
    return _explicit
  }
  const _match = _query.match(/\bafter\s+(.+?)(?:[?.!]|$)/i)
  if (_match?.[1]) {
    return normalize(_match[1])
  }
  return null
}

export async function answerCurrentPageQuestion(
  _query: string,
  _anchorText?: string
): Promise<PageAnswer> {
  const _page = await getCurrentPageText()
  const _anchor = inferAnchor(_query, _anchorText)
  if (!_anchor) {
    return {
      answer: 'I can answer page questions that identify nearby text, like "what comes after flour?"',
      pageTitle: _page.title
    }
  }

  const _answer = extractAfterAnchor(_page.text, _anchor)
  if (!_answer) {
    return {
      answer: `I could not find "${_anchor}" in the current page text.`,
      pageTitle: _page.title
    }
  }
  return {
    answer: `After ${_anchor}: ${_answer}`,
    pageTitle: _page.title
  }
}
