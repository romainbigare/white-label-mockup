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
| 4 | **Weather leaves the inbox entirely**, not just the type menu. A weather warning is a notification, not an action, so nothing that lists work to be done reads one any more — not D1, not the plot, not the count of unsent items. D6 stays, reached from the farm's weather strip and from F15. | *"It's a notification, not an advice." — "Yeah, let's remove it." — "So that's an alert from the weather box."* |
| 5 | **Nutrition is called Fertilisation**, here and everywhere a farmer reads it. | *"'Nutrition' is a bit confusing … Fertilisation."* |
| 6 | **Type and Progress swap places.** Type's answers are one word, so it takes a narrow column; Progress's are three, so it takes the full width. | *"Put 'type' where 'progress' is, because those are short words."* |
| 7 | **A sort control**, defaulting to **by field**: a list ordered by arrival puts two fields' urgent work through each other, and a farmer walking his land works one field at a time. The other two orders are by severity and by delivery time. The order also sets the headings. It sits **on the first section heading** rather than as a fourth menu in the screener: it does not change which advice is listed, and given a labelled row of its own it cost the screen a whole card. | *"So it's like your emails. You can give them the option … sort by delivery time, sort by urgency level, or sort by field."* |
| 8 | **The card is three lines**: severity and kind, the ground it is about, and what to do. The amount, the diagnosis and the two action buttons moved to the detail screen. | *"On D1 I have no more than three lines: 'urgent irrigation', 'date palms at Al Hayer North', and maybe the first line."* |
| 9 | **A share control on the card**, and nothing else: top right, out of the first line's flow, drawn as a tinted disc rather than a bare glyph so it reads as the one thing on the card that is pressable. The icon dropped beside it — the severity chip already carries a glyph and a third on one line cost the type name its last few pixels. The share glyph is the iOS one, the box with the arrow rising out of it, rather than Lucide's three-node graph. | *"All these guys will do a screenshot and just send the screenshot."* |
| 10 | **"Send all to Hassan" became "Send all to…"**, opening the team — and the block around it became one line: a count and that one action. **"Always send automatically" came off entirely**; a standing rule set from a button on the busiest list in the app is a lot of consequence for one tap, and the standing rules live on F9 where they can be read together. | *"I think it's 'send all to', but then you need to have a drop-down menu."* |
| 11a | **"Sent to Hassan" reads "Shared with Hassan"** wherever the state is reported. The verb on the control stays "Send to" — it is what Mark said and what actually happens — and the past tense follows the decision that replaced assigning with sharing, which is also what the progress filter already said. | Reconciling 3 with the sharing decision |
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

**Closed since:** the definitive list arrived — nineteen features from the
supplier document, fifteen of which differ between the levels. It replaced the
placeholder rows, and it softened rule 27 in the process: the four shared rows
are kept deliberately, as anchors. What buries a comparison is twenty identical
ticks, not four, and a farmer reading a column of nothing but dashes cannot tell
whether the thing he came for is in Basic at all.

The list also came flat, with no topics, so the table has no group headings. The
headings had been repeating the column labels every few rows; the header row is
sticky instead, so BASIC and PRO stay in view while the nineteen go past.

One row is worth flagging. **"Satellite monitoring (10 m & 3 m)"** and **"high
resolution imagery (1 m)"** put satellite resolution back on this page, which
the 01/09 review took off it — *"I don't think the satellite resolution,
cloud-free data, etc. is useful. It suggests the basic service is degraded."*
The list is the reviewer's own and later, so it stands; recorded here in case
the earlier argument was meant to survive.

One word changed in transcription: **"Scouting and task tracking"** is
**"Scouting and job tracking"**. Nothing in this app is a task — the v1.5.4
review deleted the concept and `tools/syntax.sh` fails the build if the word
comes back.

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

---

# The second pass over the same round

Read back against the screens rather than against the transcript.

## A new screen — B14 · Manage workforce

| # | Change |
|---|---|
| 33 | **B2's "Explore" group is called "More"**, and it carries a **Manage workforce** row beside Reports and Farm settings. "Explore" was a heading over two settings rows — a promise of somewhere to go and a delivery of somewhere to configure. |
| 34 | **B14 is the address book a farm runs on**: the people work is sent to, each a name, a number and the app he actually reads. Adding, editing and removing all happen in one sheet. Nobody here holds an account — an advice reaches them as a message with a link — except the one person invited as supervisor, which is a switch on the sheet. |
| 35 | It is deliberately **not** §5.6, the workforce the v1.5.4 review deleted. There are no permissions, no per-person queues and nothing read back: this exists because the Send-to sheet and F9 both have to name a person the app has been told about. Removing somebody also removes them from every standing rule on F9, so a rule never points at a man who is gone. |

## The tour

| # | Change |
|---|---|
| 36 | **More air between the elements.** The panels were set at one 14 px gap throughout — a list's rhythm on a poster — so the picture, the headline and two paragraphs read as one undifferentiated column. The gap is a paragraph now, and the picture gets a wider one under it than the words get between them. |
| 37 | **A4D's three percentages came off**, leaving the benefits named and one figure on the card: a farmer deciding whether to sign up is deciding about his profit, and three of the four ranges were the workings for the fourth. |
| 38 | **The three benefits sit in one quiet box, centred**, with the funnel below it and the profitability figure in its own box — three things becoming one, which is the argument the panel makes. |
| 39 | **"Potential increase in farm profitability."** It is a range across six million farms, not a promise about this one. |
| 40 | **A4A's copy followed the app.** It offered to "assign individual tasks"; nothing is assigned any more and nothing is a task, so it shares a piece of advice. |

## The code goes to the number

| # | Change |
|---|---|
| 41 | **A5 asks for the mobile number before the email address**, because it is the field the next screen depends on. |
| 42 | **The code goes to the number, by SMS** — on A5, on A6, on A3's "send a code instead", and on the reset. The account is still the email address; a one-time code is not an identity, it is a message that has to arrive in seconds on a phone in a field, which is something an SMS does and an inbox does not. |
| 43 | **A6 aligns to the top.** It was centred vertically, which reads as a screen still loading. |
| 44 | **FORGOT shows the two contact buttons from A3** instead of printing our email address and WhatsApp number inside a paragraph. A farmer who has just failed to log in should not have to copy a number out of a body of text. |

## The rest

| # | Change |
|---|---|
| 45 | **A9 asks "What is growing on this farm?"** — not "on this land". Same on B11. |
| 46 | **F6 is in the first-run walk, after A13.** That is where a farmer actually opens it: A13 offers two levels and a price, and the question it raises is one tap away. |
| 47 | **C5's explanation of boundary versioning came off the screen.** It explained the data model to somebody in the middle of dragging a corner. The rule still holds and F11 is where the record is readable. |
| 48 | **D6 is deleted.** A weather alert on the advice detail shell made a forecast look like a job, one round after the same review settled that weather is a notification and not an advice. **F15 carries what D6 carried**: the threshold crossed, the window it falls in, the alerts we watch for, and the rule that severe weather always gets through. |
| 49 | **F6's deck note is gone**, and **D1's lost its last line**. |
| 50 | **F9's opening paragraph is one sentence.** |
| 51 | **Superseded advice is out of the inbox.** A replaced recommendation is a card the farmer can do nothing with, sitting where one he can act on should be. WF5.104 is not dropped: an old link still opens the advice, and the detail screen is where it says it has been replaced and hands him the newer one. |
| 52 | **D3 is called Fertilisation advice**, matching the word settled everywhere else. |
| 53 | **B13 has one heading where it had two.** "What we can see from above" and "How the trees are doing" were one question asked twice — the satellite readings *are* how the trees are doing, measured, and the distribution is the same thing counted. Both cards now sit under **Health overview**. |

## PowerPoint-specific (second pass)

| # | Change |
|---|---|
| P5 | **B14 prints after B10**, at the end of My Farm. |
| P6 | **F9's note card is gone**, and **D1's lost its first line** as well as its last. |
| P7 | **The path caption is off every slide.** Each page carried its flow's name in italic above the thumbnails — "Signing up, and we survey the whole farm". The pictures already say it: five phones with arrows between them, one at full strength, is a sentence read in a glance, and on a page whose point is room to write in, a line of our prose is a line of the reviewer's margin. The name is still in the speaker notes. |
