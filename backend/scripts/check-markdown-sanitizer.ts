import { sanitizeMarkdownMathInput } from "../../CReD_Sandbox/src/app/components/markdownSanitizer";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const fixtures = [
  {
    name: "broken boundary condition",
    input: `where 
f
(
x
)
f(x) describes how much heat is added along the bar. The **ends are held at $0^\\circ
C
∗
∗
,
s
o
C∗∗,sou(0)=u(1)=0$.`,
    checks: (out: string) => {
      assert(!out.includes("∗"), "unicode stars should be normalized");
      assert(!/\bf\s+\(\s*x\s*\)/.test(out), "spaced math token should be compacted");
      assert(out.includes("f(x)"), "core math token should survive");
      assert(/u\(0\)=u\(1\)=0/.test(out), "boundary condition should remain visible");
    },
  },
  {
    name: "broken heating function",
    input: `An engineer places five equally spaced sensors inside the bar (not at the ends), uses step size h=1/6\\, and assumes constant heating 
f
(
x
)
=
36
f(x)=36.`,
    checks: (out: string) => {
      assert(!/\bf\s+\(\s*x\s*\)/.test(out), "line fragmentation should be compacted");
      assert(out.includes("h=1/6\\,"), "latex spacing token should be preserved as plain text");
      assert(out.includes("f(x)=36"), "heating equation should remain");
    },
  },
  {
    name: "broken condition number",
    input: `Each mount’s stiffness is a $2\\times 2
p
o
s
i
t
i
v
e
d
e
f
i
n
i
t
e
m
a
t
r
i
x
positivedefinitematrixK$.

The condition number 
κ
=
λ
max
⁡
/
λ
min
⁡`,
    checks: (out: string) => {
      assert(!/\n{3,}/.test(out), "paragraph noise should be reduced");
      assert(out.includes("$2\\times 2"), "matrix size math should remain in-band");
      assert(/matrix/i.test(out), "matrix wording should remain");
      assert(/\bK\b/.test(out), "matrix symbol K should remain");
    },
  },
];

for (const fixture of fixtures) {
  const out = sanitizeMarkdownMathInput(fixture.input);
  fixture.checks(out);
}

console.log(`Sanitizer checks passed (${fixtures.length} fixtures).`);
