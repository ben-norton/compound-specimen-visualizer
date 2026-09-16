# Compound Specimens README
> compound_specimens.md  
> 2026-09-16  
> geoda-transformation-pipeline  

## Definitions  
* Compound Specimen: A collection object comprised of one or more parts, called specimen parts, unified by physical attachment and distinguished from one another in a particular context. The object's identity depends on the identity of its parts.
* Specimen Part: Physically discernible and proximal parts of a Compound Specimen identified by a single determination based on physical and chemical exclusivity relative to the parent object.
* Simple Specimen: A collection specimen identified by a single determination or name
* Collection Object: A physical or digital object that belongs to a museum collection
* Simple Specimen Model: The conceptual model for the digital representation of physical specimens where each entity is characterized by one and only one determination
* Compound Specimen Model: A conceptual data model in which a single physical object is composed of and defined by its constituent parts (also objects themselves) and, therefore, multiple determinations. The Constituent Parts are unified through physical attachment or other unifying criteria.

## Data Structures
Compound specimens are constructed in the import_datasets using the self-join id = is_part_of
* Specimen part records are any record where is_part_of is not null
* Records where is_part_of is null and catalog_number is not null are simple or compound specimens. To differentiate compound specimens from simple specimens, use the following condition:
Compound Specimen: id is NOT NULL, is_part_of IS NULl AND id IS IN (SELECT is_part_of)
* Compound specimens are records where id IS NOT NULL and id exists in the is_part_of column establishing the self-join.
* The import datasets contain a mix of simple and compound specimens.
* The name of compound specimens is stored in the cataloged_name field
* The name of the specimen part is stored in the authoritative name


 