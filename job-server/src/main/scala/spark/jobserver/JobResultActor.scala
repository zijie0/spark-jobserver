package spark.jobserver

import java.util.concurrent.TimeUnit

import scala.collection.mutable
import akka.actor.ActorRef
import com.google.common.cache.CacheBuilder
import spark.jobserver.common.akka.InstrumentedActor
import spark.jobserver.common.akka.metrics.YammerMetrics
import spark.jobserver.util.LRUCache

/**
 * It is an actor to manage results that are returned from jobs.
 *
 * TODO: support multiple subscribers for same JobID
 */

class TimeLRUCache[V](cacheSize: Int) {

  private val refCache =
    CacheBuilder.newBuilder()
      .maximumSize(cacheSize / 2)
      .expireAfterWrite(2, TimeUnit.MINUTES)
      .build[String, AnyRef]

  private val lruCache = new LRUCache[String, V](cacheSize / 2)

  def put(k: String, v: V): Unit = v match {
    case x: AnyRef => refCache.put(k, x)
    case _ => lruCache.put(k, v)
  }

  def size: Long = refCache.size + lruCache.size
  def refSize: Long = refCache.size

  def getRef(k: String): Option[AnyRef] = Option(refCache.getIfPresent(k))

  def get(k: String): Option[V] = lruCache.get(k)
}

class JobResultActor extends InstrumentedActor with YammerMetrics {
  import CommonMessages._

  private val config = context.system.settings.config
  private val cache = new TimeLRUCache[Any](config.getInt("spark.jobserver.job-result-cache-size"))

  private val subscribers = mutable.HashMap.empty[String, ActorRef] // subscribers

  // metrics
  val metricSubscribers = gauge("subscribers-size", subscribers.size)
  val metricResultCache = gauge("result-cache-size", cache.size)

  def wrappedReceive: Receive = {
    case Subscribe(jobId, receiver, events) =>
      if (events.contains(classOf[JobResult])) {
        subscribers(jobId) = receiver
        logger.info("Added receiver {} to subscriber list for JobID {}", receiver, jobId: Any)
      }

    case Unsubscribe(jobId, receiver) =>
      if (!subscribers.contains(jobId)) {
        sender ! NoSuchJobId
      } else {
        subscribers.remove(jobId)
        logger.info("Removed subscriber list for JobID {}", jobId)
      }

    case GetJobResult(jobId) =>
      sender ! cache.getRef(jobId).orElse(cache.get(jobId)).map(JobResult(jobId, _)).getOrElse(NoSuchJobId)

    case JobResult(jobId, result) =>
      cache.put(jobId, result)
      logger.info(s"JobID $jobId, ref size: ${cache.refSize}, total size: ${cache.size}")
      logger.debug("Received job results for JobID {}", jobId)
      subscribers.get(jobId).foreach(_ ! JobResult(jobId, result))
      subscribers.remove(jobId)
  }

}
