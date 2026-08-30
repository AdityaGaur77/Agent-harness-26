# Social posts

Three posts, each anchored to one visible artifact. Handles verified: X
@WeMakeDevs, @truefoundry, @QodoAI; LinkedIn linkedin.com/company/wemakedevs,
linkedin.com/company/truefoundry, linkedin.com/company/qodo.

---

## Post 1: the gate firing, Deny then Allow

<<CLIP: 20-second screen recording, execute_deletion reaching the approval
gate, choosing Deny and watching the agent revise, then choosing Allow and
watching it execute>>

**X**

> Our GDPR erasure agent reaches execute_deletion and TrueForge stops cold.
> Deny it: the agent revises the plan itself. Allow it: it executes. The
> pause isn't the model being polite, it's an MCP annotation the harness
> enforces. @WeMakeDevs @truefoundry @QodoAI

(258 characters)

**LinkedIn**

> The moment our GDPR erasure agent tries to actually delete a customer's
> data, TrueForge stops it and shows a human the plan and the measured blast
> radius first.
>
> In this clip we deny it once, on purpose, and watch the agent revise
> rather than retry the same plan. Then we allow it, and it executes.
>
> Nothing about that pause lives in a prompt telling the model to ask nicely.
> It's a destructive-tool annotation the harness enforces on its own, whether
> or not the agent remembers to be careful.
>
> Built on TrueForge for the Agent Harness Hackathon, reviewed through Qodo.
> @TrueFoundry @Qodo @WeMakeDevs

---

## Post 2: the annotations file as the security boundary

<<SCREENSHOT: annotations.ts, the READ_ONLY and DESTRUCTIVE exports, four
lines, nothing else in frame>>

**X**

> This four-line file is the actual security boundary in our GDPR erasure
> agent, not the SQL, not the tool code. One annotation decides whether a
> destructive write pauses for a human or runs unattended.
> @WeMakeDevs @truefoundry @QodoAI

(233 characters)

**LinkedIn**

> We assumed the code worth reviewing carefully in this project would be the
> SQL: the deletion logic, the transaction handling, the cascade rules.
>
> It isn't. It's this file. Four lines mark one tool as destructive. That one
> annotation is what makes TrueForge pause for a human before an irreversible
> write runs. Miss it on a new tool, or flip it by accident, and the harness
> stops pausing, silently.
>
> Once we noticed that, our review priority inverted. This is the file we
> read line by line before every merge now.
>
> Built on TrueForge, reviewed through Qodo, for the Agent Harness Hackathon.
> @TrueFoundry @Qodo @WeMakeDevs

---

## Post 3: the rehearsal next to the policy row that caused it

<<SCREENSHOT: rehearsal output (would_be_illegal: true, retention_violations
naming orders/order_items) side by side with the matching row queried
directly from retention_policies>>

**X**

> Left: our agent's rehearsal, flagging that a naive delete would destroy
> tax records. Right: the exact row in retention_policies it read to know
> that. Nothing about that rule was in the prompt. @WeMakeDevs @truefoundry
> @QodoAI

(225 characters)

**LinkedIn**

> Two screenshots, same moment. On the left, our GDPR erasure agent's shadow
> rehearsal, reporting that the naive plan would destroy records under a
> retention obligation. On the right, the exact row in retention_policies it
> read to reach that conclusion, queried directly against the database.
>
> No retention period, no table name, no policy value appears anywhere in
> the agent's instructions or its skill file. It found this by reading the
> table at request time, the same way a person auditing the decision would.
> That's the property we designed the whole system around.
>
> Built on TrueForge for the Agent Harness Hackathon, reviewed through Qodo.
> @TrueFoundry @Qodo @WeMakeDevs
