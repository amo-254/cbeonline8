/** Deterministic performance comments ported from the V67 desktop report generator. */
const classOpenings = [
 ["Outstanding performance.","Excellent achievement.","Impressive work throughout.","A very strong result.","Excellent progress shown.","Remarkable effort and achievement.","Superb performance this term.","A highly commendable result.","Very impressive achievement.","Excellent learning habits shown."],
 ["Very good performance.","Strong progress shown.","A commendable result.","Good achievement overall.","Very encouraging progress.","A strong effort this term.","Good learning progress.","A pleasing performance.","Consistent effort is evident.","Very good work overall."],
 ["Good progress is evident.","A satisfactory performance.","Steady improvement is shown.","Fair progress this term.","A positive effort overall.","Encouraging progress is visible.","A sound performance overall.","Progress is developing well.","A reasonable result this term.","Good effort has been shown."],
 ["Some progress is evident.","A fair effort has been made.","Improvement is beginning to show.","There is room for improvement.","Progress is developing gradually.","More consistent effort is needed.","A modest improvement is visible.","The learner is making some progress.","Continued effort is required.","Some key skills are developing."],
 ["More effort is required.","Greater focus is needed.","Improvement is necessary.","The learner needs more support.","More consistent practice is needed.","Additional effort will help.","Key areas need attention.","The learner should work more steadily.","Further improvement is required.","Focused support is needed."]
];
const classEndings = [
 ["Keep maintaining this excellent standard.","Continue aiming high in every learning area.","Keep up the excellent work and consistency.","Maintain these strong learning habits.","Continue challenging yourself to excel.","Keep working with the same determination."],
 ["Keep working consistently to reach an even higher level.","Continue strengthening the few weaker areas.","Maintain the good effort and aim higher.","Keep practising to build on this success.","Stay focused and continue improving.","Keep developing confidence and accuracy."],
 ["Regular revision will lead to further improvement.","Keep practising the areas that need attention.","Continue working steadily and confidently.","A little more consistency will raise achievement.","Use feedback well and keep improving.","Keep revising regularly to strengthen understanding."],
 ["Regular practice will help improve the results.","Give extra attention to the challenging areas.","More revision and concentration will help.","Keep using feedback to strengthen weak areas.","A more consistent study routine is encouraged.","Continue practising and ask for help when needed."],
 ["Regular practice and guidance are strongly encouraged.","Work closely with the teacher on the weak areas.","Set small learning targets and practise daily.","More revision and concentration will improve results.","Use feedback carefully and keep trying.","Consistent support and practice will build confidence."]
];
const hoiOpenings = [
 ["Excellent achievement.","Outstanding overall performance.","A highly commendable result.","Impressive academic progress.","Excellent standards have been demonstrated.","A remarkable performance.","Very strong achievement overall.","An exemplary result.","Excellent progress is evident.","A most encouraging performance."],
 ["Very good achievement.","Strong performance overall.","Commendable progress is evident.","A very encouraging result.","Good academic progress has been made.","A strong result this term.","Very pleasing progress.","Consistent achievement is evident.","A commendable performance.","Positive progress has been sustained."],
 ["Satisfactory progress is evident.","Good progress has been made.","A fair and encouraging result.","Steady academic progress is shown.","The performance is satisfactory.","Positive development is evident.","A reasonable result has been achieved.","Progress is moving in the right direction.","The learner has shown useful progress.","A sound effort is evident."],
 ["Some improvement is evident.","Further progress is achievable.","The learner is showing gradual progress.","More consistent effort is encouraged.","There is potential for better achievement.","Continued support will be beneficial.","Progress is developing gradually.","Additional focus is recommended.","Some positive development is evident.","Improvement should remain a priority."],
 ["Further support is recommended.","Focused improvement is required.","Additional academic support is needed.","More consistent effort is necessary.","Targeted intervention is recommended.","Greater attention to learning is required.","The learner requires closer academic support.","Improvement should be actively supported.","Key learning gaps need attention.","A structured improvement plan is advisable."]
];
const hoiEndings = [
 ["Maintain the excellent standard.","Continue with the same commitment and discipline.","Keep pursuing excellence consistently.","Sustain these excellent learning habits.","Continue setting high personal goals.","Maintain this admirable level of achievement."],
 ["Maintain the positive learning habits.","Continue aiming for even higher achievement.","Sustain the good effort and consistency.","Keep strengthening areas that need attention.","Continue building on this good foundation.","Maintain focus and purposeful study habits."],
 ["Continued guidance will support further growth.","Regular follow-up will help raise achievement.","Keep reinforcing the areas that need attention.","Consistent study habits should be maintained.","Further effort will lead to stronger outcomes.","Encourage regular revision and purposeful practice."],
 ["Regular monitoring and support are encouraged.","Targeted practice should continue.","Clear learning targets will support improvement.","Close follow-up will help strengthen achievement.","Encourage steady revision and greater focus.","Continued guidance should produce better outcomes."],
 ["Provide regular guidance and close monitoring.","Target weak areas through consistent practice.","Set achievable targets and review progress regularly.","Home and school support should work together.","Encourage daily practice and careful follow-up.","Focused intervention should continue consistently."]
];
export function performanceComments(percent: number, learnerId: number) {
 const band = percent >= 80 ? 0 : percent >= 65 ? 1 : percent >= 50 ? 2 : percent >= 35 ? 3 : 4;
 const scoreKey = learnerId * 37 + Math.round(percent * 10);
 const classIdx = ((scoreKey % 60) + 60) % 60;
 const hoiIdx = (((scoreKey * 17 + 11) % 60) + 60) % 60;
 return {
  classComment: `${classOpenings[band][Math.floor(classIdx / 6)]} ${classEndings[band][classIdx % 6]}`,
  hoiComment: `${hoiOpenings[band][Math.floor(hoiIdx / 6)]} ${hoiEndings[band][hoiIdx % 6]}`,
 };
}
