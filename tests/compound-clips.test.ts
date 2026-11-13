import {clipAlpha} from '../src/services/visualSettings';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {joinSelectedClips,expandCompoundClips} from '../src/services/compoundClips';import {sourceTime} from '../src/services/clipSpeed';
const tracks:any[]=[{id:'v',type:'video'},{id:'a',type:'audio'}];
function parts():any[]{return [0,1,2].flatMap(i=>[{id:'v'+i,type:'video',trackId:'v',name:'source',mediaUrl:'/media_downloads/source.mp4',startTime:i,duration:1,offset:i*2,transparency:100,volumeDb:0,fadeIn:0,fadeOut:0,color:'blue',isLinked:true,linkedClipId:'a'+i},{id:'a'+i,type:'audio',trackId:'a',name:'source',mediaUrl:'/media_downloads/source.mp4',startTime:i,duration:1,offset:i*2,transparency:100,volumeDb:0,fadeIn:0,fadeOut:0,color:'green',isLinked:true,linkedClipId:'v'+i}]);}
for(const mode of ['video','audio','both'])test(`joining ${mode} respects exact selection and retains every source interval`,()=>{
 const input=parts(),ids=input.filter(c=>mode==='both'||c.type===mode).map(c=>c.id),result=joinSelectedClips(input,tracks,ids);
 assert.equal(result.joinedIds.length,mode==='both'?2:1);assert.equal(result.clips.length,mode==='both'?2:4);
 for(const type of ['video','audio']){const leaves=expandCompoundClips(result.clips).filter(c=>c.type===type);assert.equal(leaves.length,3);assert.deepEqual(leaves.map(c=>[c.startTime,c.duration,c.offset]),[[0,1,0],[1,1,2],[2,1,4]]);}
 if(mode==='audio')assert.ok(result.clips.filter(c=>c.type==='video').every(c=>c.suppressEmbeddedAudio));
 if(mode==='both')assert.equal(result.clips[0].linkedClipId,result.clips[1].id);
 assert.equal(input.length,6);assert.equal(input[0].linkedClipId,'a0');
});
test('trimmed, moved and accelerated compound keeps source offsets',()=>{const result=joinSelectedClips(parts(),tracks,['v0','v1','v2']);const c=result.clips.find(c=>c.segments)!;const leaves=expandCompoundClips([{...c,startTime:10,offset:.5,duration:1,speedLevel:5}]);assert.deepEqual(leaves.map(c=>[c.startTime,c.duration,c.offset]),[[10,.125,.5],[10.125,.25,2],[10.375,.25,4]]);assert.equal(sourceTime(leaves[1],10.25),2.5);});
test('unselected intermediate pieces and invalid selections are rejected',()=>{assert.throws(()=>joinSelectedClips(parts(),tracks,['v0','v2']),/non selezionati/);assert.throws(()=>joinSelectedClips(parts(),tracks,['v0','a0']),/stessa pista/);});

test('compound fades continue across internal seams and survive a source trim',()=>{const result=joinSelectedClips(parts(),tracks,['v0','v1','v2']);const c=result.clips.find(c=>c.segments)!;const leaves=expandCompoundClips([{...c,fadeIn:2}]);assert.ok(Math.abs(clipAlpha(leaves[1],.5)-.75)<.0001);const cropped=expandCompoundClips([{...c,offset:1,duration:2,fadeOut:2}]);assert.ok(Math.abs(clipAlpha(cropped[1],.5)-.25)<.0001);});
