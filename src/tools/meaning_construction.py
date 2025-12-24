# Path: src/tools/meaning_construction.py

def make_meaning_combo_html(i):
    """
    Tạo HTML cho định nghĩa.
    Input 'i' là object DpdHeadword (duck typing).
    """
    html = ""
    if i.meaning_1:
        html = f"<b>{i.meaning_1}</b>"
        if i.meaning_lit:
            html += f"; lit. {i.meaning_lit}"
    elif i.meaning_2:
        html = i.meaning_2
        if i.meaning_lit:
            html += f"; lit. {i.meaning_lit}"
    return html

def make_grammar_line(i):
    """Tạo dòng tóm tắt ngữ pháp."""
    parts = []
    if i.grammar: parts.append(i.grammar)
    if i.neg: parts.append(i.neg)
    if i.verb: parts.append(i.verb)
    if i.trans: parts.append(i.trans)
    if i.plus_case: parts.append(f"({i.plus_case})")
    return ", ".join(parts)