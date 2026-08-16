"""Offer PDF document generation."""
from __future__ import annotations

from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def display_datetime(value) -> str:
    if isinstance(value, datetime): parsed = value
    else:
        try: parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError: return str(value or "")
    if parsed.tzinfo is not None: parsed = parsed.astimezone(ZoneInfo("Asia/Shanghai"))
    return parsed.strftime("%Y-%m-%d %H:%M")


def generate_offer_pdf(snapshot: dict) -> bytes:
    registerFont(UnicodeCIDFont("STSong-Light"))
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54,
                            title=f"Offer - {snapshot.get('candidate_name', '')}")
    styles = getSampleStyleSheet()
    title = ParagraphStyle("ChineseTitle", parent=styles["Title"], fontName="STSong-Light", fontSize=22, leading=30, alignment=TA_CENTER, textColor=colors.HexColor("#16324F"))
    body = ParagraphStyle("ChineseBody", parent=styles["BodyText"], fontName="STSong-Light", fontSize=11, leading=19, textColor=colors.HexColor("#243447"))
    small = ParagraphStyle("ChineseSmall", parent=body, fontSize=9, textColor=colors.HexColor("#64748B"))
    story = [Paragraph("录用通知书", title), Spacer(1, 26), Paragraph(f"尊敬的 {snapshot.get('candidate_name', '')}：", body), Spacer(1, 12),
             Paragraph(f"我们诚挚邀请您加入团队，担任 <b>{snapshot.get('job_title', '')}</b>。具体安排如下：", body), Spacer(1, 16)]
    data = [
        ["工作地点", snapshot.get("work_location", "")],
        ["薪酬说明", snapshot.get("salary_description", "")],
        ["预计入职日期", snapshot.get("expected_start_date", "")],
        ["试用期", snapshot.get("probation", "") or "按公司制度执行"],
        ["通知书有效期", display_datetime(snapshot.get("expires_at", ""))],
    ]
    table = Table(data, colWidths=[95, 345], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "STSong-Light"), ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EAF1F8")), ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#16324F")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("LINEBELOW", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
    ]))
    story += [table, Spacer(1, 18)]
    if snapshot.get("extra_terms"):
        story += [Paragraph("补充条款", body), Spacer(1, 6), Paragraph(str(snapshot["extra_terms"]).replace("\n", "<br/>"), body), Spacer(1, 18)]
    story += [Paragraph("请在有效期内通过招聘系统确认接受或拒绝。本通知书以系统中当前审批版本为准。", body), Spacer(1, 30),
              Paragraph(f"版本：V{snapshot.get('version', 1)}", small), Paragraph("招聘管理系统", small)]
    doc.build(story)
    return buffer.getvalue()
