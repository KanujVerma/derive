-- Changed F01/F04 decision semantics require a new release hash. This does not
-- authorize production, educational423, pending science or any source/claim.
-- The existing history trigger preserves an eligible previous tuple exactly;
-- current eligibility is disabled until a separately reviewed local transition.
update private.part_four_release set
 release_id='part-four-foundations/v1',
 release_hash='09d1dd866c282187bbfdee37b3b6972deefb1c7787a1db6bfeb103576292f2b5',
 knowledge_version='approved-37-v7/editorial-v1',
 knowledge_hash='7d87dfb01c6039e26617802f36dbf6476992d6e6e7623d470aab7ed07b69715b',
 scientific_manifest_hash=null,
 permitted=false
where id=true;
