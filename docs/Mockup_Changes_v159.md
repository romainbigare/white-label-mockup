# v1.5.9 — the Monday review

The Monday call ran an hour and forty-three minutes and covered two products.
The first hour is the **ADAFSA dashboard** — crop monitoring C1–C3, tree
monitoring T1–T3 — and none of it belongs here. The **Wafra Farm app** section
runs from `[01:10:56]`, where Romain says "well, I sent you version 158", to the
end of the recording, and this document is what was agreed in it.

- Round 10, the sixty-six marks on the v1.5.7 deck: [`Mockup_Changes_v158.md`](Mockup_Changes_v158.md)
- Round 11, this document

The requirement set underneath is still **v1.7** in name, and one rule under it
moved: an advice is no longer assigned to anybody. It is recorded here.

---

## The one decision everything else follows

> **Mark:** *"How about we just forgo the 'assign to' and we say 'share with',
> and we just send a link to the task?"* … *"So you kind of remove the concept
> of an assignment, so you don't need to track it in the app — you don't need to
> know this was assigned to Hassan or Youssef — but you can take your advice and
> share that piece of advice with your farm manager if you want. I think the
> whole thing of accountability is overwhelming."*

The v1.5.4 round deleted the task and kept the accountability: an advice was
*assigned* to the one supervisor, the app remembered who held it, and closing it
meant filling in what was actually applied. This round deletes the
accountability too.

What that removes: the concept of an assignee, the "take it back" action, and
**D7** entirely. What it adds: a **team** the farmer can pick from, and a
**Completed** button he presses himself.

It is also why the same review could shrink D1's card to three lines. The card
was large because it carried a decision, a state and two buttons; with nothing
to track it only has to carry a summary.

---

## D1 · Advice inbox

| # | Change | Where it came from |
|---|---|---|
| 1 | **"Good" comes off the severity menu.** The three severities an advice can carry are Urgent, Planned and Monitor. | *"'Good' has no place here. 'Plan' or 'monitor'."* |
| 2 | **"Any severity" and "Any progress" both read "All".** | *"Instead of 'any progress', instead of 'any severities' — 'all'."* |
| 3 | **Progress reads All · Not actioned yet · Shared · Done.** "Shared" rather than "Assigned", which is the wording the assignment decision eight minutes later forces. | *"'Not actioned yet' … and 'complete' or 'done'."* |
| 4 | **Weather comes off the type menu.** A weather warning is a notification, not an action. | *"You mean it doesn't tell you to go cover your trees … Okay, let's remove that."* |
| 5 | **Nutrition is called Fertilisation**, here and everywhere a farmer reads it. | *"'Nutrition' is a bit confusing … Fertilisation."* |
| 6 | **Type and Progress swap places.** Type's answers are one word, so it takes a narrow column; Progress's are three, so it takes the full width. | *"Put 'type' where 'progress' is, because those are short words."* |
| 7 | **A sort control**, under the three filters: by delivery time, by severity, or by field. The order also sets the headings — sorted by field, the list is grouped by field. | *"So it's like your emails. You can give them the option … sort by delivery time, sort by urgency level, or sort by field."* |
| 8 | **The card is three lines**: severity and kind, the ground it is about, and what to do. The amount, the diagnosis and the two action buttons moved to the detail screen. | *"On D1 I have no more than three lines: 'urgent irrigation', 'date palms at Al Hayer North', and maybe the first line."* |
| 9 | **A share control on the card**, and nothing else. | *"All these guys will do a screenshot and just send the screenshot."* |
| 10 | **"Send all to Hassan" became "Send all to…"**, opening the team. | *"I think it's 'send all to', but then you need to have a drop-down menu."* |
| 11 | **No multi-select mode.** Proposed and turned down. | *"That's too much. Too much on this page."* |

**Not built, deliberately:** the expanding card. It was weighed against the tap
through to D2 and lost — *"Personally I prefer D2 … it's more scalable for
adding content"*, and Mark agreed.

## D2 · Irrigation advice (and D3, D4, D6, which share the shell)

| # | Change | Where it came from |
|---|---|---|
| 12 | **The dock is three buttons in two rows.** "Send to" full width at the top, then "Ignore" and "Completed" side by side beneath it. | *"So 'send to' with the menu is at the top, and maybe below that, left to right, two other buttons: 'ignore' and 'completed'." … "So the share button is full-length top right."* |
| 13 | **"Completed" came out of the ⋯ menu.** It closes the advice outright. | *"What about 'completed'?"* |
| 14 | **"Take it back" is gone.** There is nothing to take back once nobody is accountable. | Follows from the assignment decision. |

## D7 · Record what you did — deleted

| # | Change | Where it came from |
|---|---|---|
| 15 | **The screen is gone**, with the three-outcome form, the not-done reasons and the offline record behind it. | *"So D7?" — "I think we'll remove that."* |

## The team, and the sheet that names it

| # | Change | Where it came from |
|---|---|---|
| 16 | **A "Send to" sheet**, opened from the card, from the detail dock and from "Send all to…". It lists the people on the team and sends on a tap. | *"So I say 'send to', and then I have three names — Mark, Romain and Caroline — and I can assign it to any one of the people I've recorded as being my team."* |
| 17 | **"Always send automatically" now asks who**, instead of assuming the supervisor. | Follows from 16. |

## F0 · More

| # | Change | Where it came from |
|---|---|---|
| 18 | **"Units and formats" comes off this menu.** It stays under Settings, which already names it. | *"I've left units and formats under 'more', which we don't want."* |

## F8 · Units and formats

| # | Change | Where it came from |
|---|---|---|
| 19 | **The calendar offers Gregorian; Gregorian and Hijri; Hijri.** Single, double, single. The old set offered two ways of showing both and left Gregorian-alone unreachable. | *"It's Gregorian; Gregorian and Hijri; or Hijri. Three options."* |
| 20 | **Translation coverage is off the screen.** It reported how far this mockup's own catalogue had got, which is a fact about the build. | *"I don't quite understand this 'translation coverage'. I would remove that."* |

## F9 · Notifications → **Advice distribution**

| # | Change | Where it came from |
|---|---|---|
| 21 | **Renamed.** The word "notifications" was competing with the phone's own. | *"This is more like advice notifications, perhaps … or 'advice distribution'." — "Oh, I like 'advice distribution'."* |
| 22 | **It is about advice and nothing else.** The weekly report, the trial reminder, the marketing opt-in and the team notice are off it. | *"Notifications is advice specifically, right?"* |
| 23 | **Organised by type — irrigation, fertilisation, crop protection — not by urgency.** | *"Are people more likely to assign urgent/plan/monitor, or assign irrigation/nutrition/crop protection? Probably the latter … irrigation is the irrigation manager."* |
| 24 | **Three channels: SMS, WhatsApp, Telegram.** Email is gone and so is push. Capitalisation fixed. | *"I would forget about email, because it's not very urgent … Forget about push."* |
| 25 | **Each channel names people.** Pressing one opens the team; tick one, two or all three. | *"Well, who's WhatsApp?" … "There's a menu, I've got three people on my team, I can assign it to one or both or all three."* |
| 26 | **Weather is not distributed.** It stays in the app, on F15 and D6. | *"The weather alert, I think, just goes to the app, it doesn't get sent out."* |

## F6 · Compare plans

| # | Change | Where it came from |
|---|---|---|
| 27 | **Every row differs between the two levels.** A feature both plans carry is not a reason to choose between them, so it is not on the page. "Correct a plot boundary after the fact" and nineteen like it are gone. | *"It's not too much detail, it's the wrong detail."* |
| 28 | **One table.** The crops and trees tabs are gone; a tree feature is a row like any other. | *"Any way we can do a basic and pro without doing crops and trees — just the way we present it?"* |
| 29 | **The line above the table is gone.** | *"'Everything in basic is in pro as well' — I would remove that. People can see there are two levels."* |

**Still open:** the definitive list of differentiating features. Mark is cleaning
it up from the supplier document and sending it. The rows now on the page are
the build's own entitlement matrix read through rule 27, and they are meant to
be replaced.

## A1 · Welcome

| # | Change | Where it came from |
|---|---|---|
| 30 | **The lockup and the sentence sit above the centre**, not on it. | *"Can we move the logo up a bit? … the logo needs to be kind of centred a bit."* |
| 31 | **The language chip carries a globe**, not Lucide's translation mark. | *"Can we put a globe? It's a globe everybody uses."* |

## A1B · Choose your language

| # | Change | Where it came from |
|---|---|---|
| 32 | **The sheet opens nearly full height**, so all ten languages are visible without a drag. It was at the inline default of 78%, which is right for a sheet raised over a screen you were reading and wrong for a sheet that *is* the screen. | *"So the list should move up then. Why does it start so low? It should start higher."* |

---

## PowerPoint-specific

These are changes to the deck rather than to a screen.

| # | Change | Where it came from |
|---|---|---|
| P1 | **The deck is v1.5.9**, and D7's page has gone with the screen. | — |
| P2 | **A1B's page says it is a pop-up over A1, not a screen of its own.** The deck already draws it in place over A1; the speaker note now says so in the first line, because a reviewer flipping pages counted it as a screen. | *"So A1B is not a real screen, it's just a pop-up."* |
| P3 | **D1's page carries the full taxonomy in its notes** — all four menus and every option under each, including the new sort. | Carried forward from the 06/09 round, updated for this one. |
| P4 | **F6's page says the feature list is provisional** and names what is coming. | *"Let me clean it up and I can send you the list."* |

---

## Two things about how this was applied

**"Shared", not "assigned", on D1's progress menu.** Mark named the progress
options at `[01:14:41]` — *"so 'not assigned'; the second one is 'assigned'; and
'complete' or 'done'"* — and then removed the concept of assignment at
`[01:22:46]`. The menu takes the later decision: All · Not actioned yet · Shared
· Done.

**The team is the existing fixture.** Mark asked for *"somewhere you get your
library of team members"* and Romain agreed it was needed, but no screen for it
was drawn on the call. The Send-to sheet and F9 both read the three people
already in the fixture data — an owner and two supervisors. A screen for adding
and removing them is listed in the open questions rather than invented here.
